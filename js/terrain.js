class TerrainGenerator {
    constructor() {
        this.chunkSize = 25;
        this.chunkResolution = 60;
        this.chunkHeight = 50; // 각 수직 청크의 높이
        this.viewDistance = 4; // 렌더링 범위 축소 (8 → 4)
        this.generateDistance = 6; // 생성 범위 축소 (10 → 6)
        this.verticalChunks = 1; // 위아래 청크 수 축소 (2 → 1)
        this.scale = 1.0; // X, Y, Z 모두 동일한 스케일
        
        this.chunks = new Map();
        this.equations = [];
        this.activeChunks = new Set();
        this.generatingChunks = new Set();
        
        this.vertices = [];
        this.colors = [];
        this.indices = [];
        
        // 웹 워커 초기화
        this.initWorker();
        this.messageId = 0;
        this.pendingRequests = new Map();
        
        // 빈 청크 캐시
        this.emptyChunks = new Set();
        
        // 성능 최적화를 위한 새로운 필드들
        this.lastCameraPos = { x: 0, y: 0, z: 0 };
        this.chunkUpdateThreshold = 8; // 카메라가 이만큼 움직이면 청크 업데이트 (범위 축소로 더 민감하게)
        this.terrainDirty = false; // 지형 데이터가 변경되었는지 플래그
        this.pendingChunkUpdates = []; // 대기 중인 청크 업데이트들
        this.chunksPerFrame = 3; // 프레임당 적용할 청크 수 (범위가 작아져서 감소)
        this.lastActiveChunks = new Set(); // 이전 프레임의 활성 청크들
        
        // 증분 업데이트를 위한 버퍼 관리
        this.chunkBuffers = new Map(); // 개별 청크 버퍼 캐시
        this.bufferUpdateQueue = []; // 버퍼 업데이트 큐
    }

    // 웹 워커 초기화 - 임시로 비활성화
    initWorker() {
        console.log('웹 워커 비활성화됨 - 동기 모드로 실행');
        this.worker = null;
    }

    // 워커 메시지 처리
    handleWorkerMessage(e) {
        const { type, data, id } = e.data;
        
        switch (type) {
            case 'chunkGenerated':
                const { chunkX, chunkY, chunkZ, chunk } = data;
                const key = this.getChunkKey(chunkX, chunkY, chunkZ || 0);
                this.chunks.set(key, chunk);
                this.generatingChunks.delete(key);
                console.log(`웹 워커: 청크 생성 완료 ${key}`);
                break;
                
            case 'chunkBatchGenerated':
                console.log(`웹 워커: 배치 생성 완료`);
                const results = data;
                for (let result of results) {
                    const key = this.getChunkKey(result.chunkX, result.chunkY, result.chunkZ);
                    
                    if (result.chunk.isEmpty) {
                        this.emptyChunks.add(key);
                    } else {
                        this.chunks.set(key, result.chunk);
                    }
                    
                    this.generatingChunks.delete(key);
                }
                break;
        }
        
        if (this.pendingRequests.has(id)) {
            const resolve = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);
            resolve(data);
        }
    }

    setEquations(equations) {
        this.equations = equations;
        this.clearChunks();
        this.terrainDirty = true; // 지형 변경 플래그 설정
        
        // 웹 워커에게 수식 전달
        if (this.worker) {
            const equationsData = equations.map(eq => ({
                compiledCode: eq.compiledCode,
                color: eq.color
            }));
            this.worker.postMessage({
                type: 'setEquations',
                data: equationsData,
                id: this.messageId++
            });
        }
    }

    clearChunks() {
        this.chunks.clear();
        this.activeChunks.clear();
        this.generatingChunks.clear();
        this.emptyChunks.clear();
        this.pendingChunkUpdates = [];
        this.chunkBuffers.clear();
        this.bufferUpdateQueue = [];
        this.lastActiveChunks.clear();
        // 경계 정점 캐시도 초기화
        if (this.boundaryVertexCache) {
            this.boundaryVertexCache.clear();
        }
    }

    // 청크 키 생성 (Z 레벨 추가)
    getChunkKey(chunkX, chunkY, chunkZ = 0) {
        return `${chunkX},${chunkY},${chunkZ}`;
    }

    // 월드 좌표를 청크 좌표로 변환
    worldToChunk(x, y, z = 0) {
        return {
            x: Math.floor(x / this.chunkSize),
            y: Math.floor(y / this.chunkSize),
            z: Math.floor(z / this.chunkHeight)
        };
    }

    // 지형 높이 계산 (모든 수식의 결과를 합성)
    getHeightAt(x, y) {
        if (this.equations.length === 0) {
            // 기본 평면 지형 (디버깅용)
            return Math.sin(x * 0.1) * Math.cos(y * 0.1) * 2;
        }
        
        let totalHeight = 0;
        
        for (let eq of this.equations) {
            try {
                const height = eq.function(x, y, 0);
                if (isFinite(height)) {
                    totalHeight += height;
                }
            } catch (e) {
                // 수식 계산 오류 시 0 반환
                console.warn('수식 계산 오류:', e);
            }
        }
        
        // 평균 높이 사용
        return totalHeight / this.equations.length;
    }

    // 지점의 색상 결정
    getColorAt(x, y, height) {
        if (this.equations.length === 0) return [0.5, 0.5, 0.5];
        
        // 가장 높은 값을 가진 수식의 색상 사용
        let maxHeight = -Infinity;
        let dominantColor = [0.5, 0.5, 0.5];
        
        for (let eq of this.equations) {
            // x, y는 이미 스케일이 적용된 좌표이므로 그대로 사용
            const eqHeight = eq.function(x, y, 0);
            if (eqHeight > maxHeight) {
                maxHeight = eqHeight;
                dominantColor = this.hexToRgb(eq.color);
            }
        }
        
        return dominantColor;
    }

    // HEX 색상을 RGB로 변환
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ] : [0.5, 0.5, 0.5];
    }

    // 청크 생성 (통일된 해상도)
    generateChunk(chunkX, chunkY, chunkZ) {
        const key = this.getChunkKey(chunkX, chunkY, chunkZ);
        if (this.chunks.has(key)) {
            return this.chunks.get(key);
        }

        const chunk = this.createChunkGeometry(chunkX, chunkY, chunkZ);
        this.chunks.set(key, chunk);
        return chunk;
    }

    // 청크 지오메트리 생성 (통일된 해상도)
    createChunkGeometry(chunkX, chunkY, chunkZ) {
        const resolution = this.chunkResolution; // 모든 청크 동일 해상도
        const size = this.chunkSize;
        const startX = chunkX * size;
        const startY = chunkY * size;
        const minHeight = chunkZ * this.chunkHeight;
        const maxHeight = (chunkZ + 1) * this.chunkHeight;
        const step = size / (resolution - 1);

        // 먼저 이 청크에 실제 지형이 있는지 빠르게 확인
        const hasContent = this.checkChunkHasContent(startX, startY, size, minHeight, maxHeight);
        if (!hasContent) {
            // 빈 청크는 생성하지 않음
            return { vertices: [], colors: [], normals: [], indices: [], isEmpty: true };
        }

        const vertices = [];
        const colors = [];
        const normals = [];
        const indices = [];

        // 스키트 확장 (경계 약간 넘어서 생성)
        const skirtExtension = 0.1; // 청크 크기의 10%
        const extendedStartX = startX - skirtExtension;
        const extendedStartY = startY - skirtExtension;
        const extendedSize = size + 2 * skirtExtension;
        const extendedStep = extendedSize / (resolution - 1);

        // 정점과 법선 생성 (스키트 포함)
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const worldX = extendedStartX + x * extendedStep;
                const worldY = extendedStartY + y * extendedStep;
                let height = this.getHeightAt(worldX * this.scale, worldY * this.scale);
                
                // 경계 정점 보정 - 인접 청크와 일치시키기
                height = this.getStitchedHeight(worldX, worldY, height, chunkX, chunkY, chunkZ, x, y, resolution);
                
                // 무한대나 NaN 처리
                if (!isFinite(height)) {
                    height = height > 0 ? maxHeight : minHeight;
                }
                
                vertices.push(worldX, worldY, height);
                
                const color = this.getColorAt(worldX * this.scale, worldY * this.scale, height);
                colors.push(...color);

                const normal = this.calculateNormal(worldX, worldY, extendedStep);
                normals.push(...normal);
            }
        }

        // 인덱스 생성 - 청크 높이 범위에 맞는 삼각형만 포함
        for (let y = 0; y < resolution - 1; y++) {
            for (let x = 0; x < resolution - 1; x++) {
                const i = y * resolution + x;
                
                // 사각형의 네 모서리 정점 높이 확인
                const v1z = vertices[i * 3 + 2];
                const v2z = vertices[(i + 1) * 3 + 2];
                const v3z = vertices[(i + resolution) * 3 + 2];
                const v4z = vertices[(i + resolution + 1) * 3 + 2];
                
                // 삼각형이 청크 높이 범위와 교차하는지 확인
                const triangle1Heights = [v1z, v2z, v3z];
                const triangle2Heights = [v2z, v4z, v3z];
                
                // 삼각형의 높이 범위가 청크 범위와 겹치는지 확인
                const tri1InRange = this.triangleIntersectsRange(triangle1Heights, minHeight, maxHeight);
                const tri2InRange = this.triangleIntersectsRange(triangle2Heights, minHeight, maxHeight);
                
                if (tri1InRange) {
                    indices.push(i, i + 1, i + resolution);
                }
                if (tri2InRange) {
                    indices.push(i + 1, i + resolution + 1, i + resolution);
                }
            }
        }

        return { vertices, colors, normals, indices, isEmpty: false };
    }

    // 경계 정점 높이 보정 - 인접 청크와 일치시키기
    getStitchedHeight(worldX, worldY, originalHeight, chunkX, chunkY, chunkZ, localX, localY, resolution) {
        const size = this.chunkSize;
        const step = size / (resolution - 1);
        
        // 경계 정점인지 확인
        const isLeftEdge = localX === 0;
        const isRightEdge = localX === resolution - 1;
        const isTopEdge = localY === 0;
        const isBottomEdge = localY === resolution - 1;
        
        if (!isLeftEdge && !isRightEdge && !isTopEdge && !isBottomEdge) {
            return originalHeight; // 내부 정점은 그대로
        }
        
        // 경계 정점의 경우 더 정확한 위치에서 샘플링
        // 청크 경계는 정확히 청크 크기의 배수여야 함
        let adjustedX = worldX;
        let adjustedY = worldY;
        
        // 경계 정점을 청크 경계에 정확히 맞춤
        if (isLeftEdge) {
            adjustedX = chunkX * size;
        } else if (isRightEdge) {
            adjustedX = (chunkX + 1) * size;
        }
        
        if (isTopEdge) {
            adjustedY = chunkY * size;
        } else if (isBottomEdge) {
            adjustedY = (chunkY + 1) * size;
        }
        
        // 조정된 위치에서 높이 재계산
        const adjustedHeight = this.getHeightAt(adjustedX * this.scale, adjustedY * this.scale);
        
        // 원래 높이와 조정된 높이의 평균 사용 (부드러운 전환)
        const blendFactor = 0.8; // 조정된 높이에 더 가중치
        return originalHeight * (1 - blendFactor) + adjustedHeight * blendFactor;
    }

    // 삼각형이 높이 범위와 교차하는지 확인
    triangleIntersectsRange(heights, minHeight, maxHeight) {
        const minTriHeight = Math.min(...heights);
        const maxTriHeight = Math.max(...heights);
        
        // 삼각형의 높이 범위가 청크 범위와 겹치는지 확인
        return maxTriHeight >= minHeight && minTriHeight <= maxHeight;
    }

    // 청크에 실제 내용이 있는지 빠르게 확인
    checkChunkHasContent(startX, startY, size, minHeight, maxHeight) {
        // 더 많은 샘플 포인트로 정확도 향상
        const sampleDensity = 4; // 4x4 그리드
        const step = size / sampleDensity;
        
        for (let y = 0; y <= sampleDensity; y++) {
            for (let x = 0; x <= sampleDensity; x++) {
                const sampleX = startX + x * step;
                const sampleY = startY + y * step;
                const height = this.getHeightAt(sampleX * this.scale, sampleY * this.scale);
                
                // 더 넓은 허용 범위 (탄젠트 같은 급격한 변화 대응)
                if (height >= minHeight - 50 && height <= maxHeight + 50) {
                    return true;
                }
                
                // 무한대나 NaN 체크
                if (!isFinite(height)) {
                    return true; // 무한대도 렌더링 시도
                }
            }
        }
        return false;
    }

    // 실제 법선 벡터 계산
    calculateNormal(x, y, step) {
        const scale = this.scale;
        const offset = step * 0.5; // 법선 계산을 위한 샘플링 거리

        // 주변 4점의 높이 샘플링
        const hL = this.getHeightAt((x - offset) * scale, y * scale); // 왼쪽
        const hR = this.getHeightAt((x + offset) * scale, y * scale); // 오른쪽
        const hD = this.getHeightAt(x * scale, (y - offset) * scale); // 아래
        const hU = this.getHeightAt(x * scale, (y + offset) * scale); // 위

        // 편미분을 이용한 법선 계산
        const dx = (hR - hL) / (2 * offset);
        const dy = (hU - hD) / (2 * offset);

        // 법선 벡터 = cross product of tangent vectors
        // tangent1 = (1, 0, dx), tangent2 = (0, 1, dy)
        // normal = tangent1 × tangent2 = (-dx, -dy, 1)
        const normal = [-dx, -dy, 1];
        
        // 정규화
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        }

        return normal;
    }

    // 카메라 위치를 기준으로 필요한 청크들 업데이트
    updateChunks(cameraX, cameraY, cameraZ = 0) {
        // 카메라 이동 거리 확인
        const cameraMoved = Math.sqrt(
            Math.pow(cameraX - this.lastCameraPos.x, 2) + 
            Math.pow(cameraY - this.lastCameraPos.y, 2) + 
            Math.pow(cameraZ - this.lastCameraPos.z, 2)
        );
        
        // 카메라가 충분히 움직였거나 지형이 변경되었을 때만 청크 업데이트
        const shouldUpdateChunks = cameraMoved > this.chunkUpdateThreshold || this.terrainDirty;
        
        if (shouldUpdateChunks) {
            this.lastCameraPos = { x: cameraX, y: cameraY, z: cameraZ };
            this.terrainDirty = false;
            this.scheduleChunkUpdate(cameraX, cameraY, cameraZ);
        }
        
        // 대기 중인 청크 업데이트 처리 (프레임당 제한)
        this.processPendingChunkUpdates();
    }

    // 청크 업데이트 스케줄링 (LOD 제거 - 모든 청크 동일 해상도)
    scheduleChunkUpdate(cameraX, cameraY, cameraZ) {
        const centerChunk = this.worldToChunk(cameraX, cameraY, cameraZ);
        const newActiveChunks = new Set();
        const chunksToGenerate = [];

        // 수평 및 수직 청크 생성 (거리순 정렬)
        const chunkRequests = [];
        
        for (let dz = -this.verticalChunks; dz <= this.verticalChunks; dz++) {
            for (let dy = -this.generateDistance; dy <= this.generateDistance; dy++) {
                for (let dx = -this.generateDistance; dx <= this.generateDistance; dx++) {
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const chunkX = centerChunk.x + dx;
                    const chunkY = centerChunk.y + dy;
                    const chunkZ = centerChunk.z + dz;
                    const key = this.getChunkKey(chunkX, chunkY, chunkZ);
                    
                    // 빈 청크는 건너뛰기
                    if (this.emptyChunks.has(key)) continue;
                    
                    // 활성 청크 범위 (더 엄격한 제한)
                    if (distance <= this.viewDistance && Math.abs(dz) <= this.verticalChunks) {
                        newActiveChunks.add(key);
                    }
                    
                    // 청크 생성 범위 (가까운 거리만)
                    if (distance <= this.generateDistance && Math.abs(dz) <= this.verticalChunks) {
                        if (!this.chunks.has(key) && !this.generatingChunks.has(key)) {
                            chunkRequests.push({ chunkX, chunkY, chunkZ, distance, key });
                        }
                    }
                }
            }
        }

        // 거리 기준으로 정렬 (가까운 것부터)
        chunkRequests.sort((a, b) => a.distance - b.distance);
        
        // 한 번에 생성할 청크 수 제한
        const maxBatchSize = 15; // 범위가 작아져서 적은 수로 조정
        
        // 새로운 청크만 생성
        for (let i = 0; i < Math.min(chunkRequests.length, maxBatchSize); i++) {
            const req = chunkRequests[i];
            this.generatingChunks.add(req.key);
            chunksToGenerate.push(req);
        }

        // 웹 워커로 청크 배치 생성
        if (chunksToGenerate.length > 0) {
            this.generateChunksBatch(chunksToGenerate);
        }

        // 활성 청크 변경 사항을 대기열에 추가
        if (!this.setsEqual(this.activeChunks, newActiveChunks)) {
            this.pendingChunkUpdates.push({
                type: 'activeChunks',
                newActiveChunks: newActiveChunks
            });
        }

        // 멀리 있는 청크들 즉시 제거
        this.removeDistantChunks(cameraX, cameraY, cameraZ);
    }

    // 대기 중인 청크 업데이트 처리
    processPendingChunkUpdates() {
        if (this.pendingChunkUpdates.length === 0) return;
        
        const updatesToProcess = this.pendingChunkUpdates.splice(0, this.chunksPerFrame);
        
        for (let update of updatesToProcess) {
            if (update.type === 'activeChunks') {
                this.activeChunks = update.newActiveChunks;
                this.mergeActiveChunks();
            } else if (update.type === 'newChunk') {
                // 새 청크 추가 시 점진적 업데이트
                this.incrementalChunkUpdate(update.chunkKey, update.chunkData);
            }
        }
    }

    // Set 비교 헬퍼 함수
    setsEqual(a, b) {
        if (a.size !== b.size) return false;
        for (let item of a) {
            if (!b.has(item)) return false;
        }
        return true;
    }

    // 증분 청크 업데이트
    incrementalChunkUpdate(chunkKey, chunkData) {
        // 개별 청크 데이터를 캐시에 저장
        this.chunkBuffers.set(chunkKey, chunkData);
        
        // 전체 병합이 필요한 경우 플래그 설정
        if (this.activeChunks.has(chunkKey)) {
            this.terrainDirty = true;
        }
    }

    // 배치로 청크 생성
    generateChunksBatch(requests) {
        if (this.worker) {
            // 웹 워커 사용
            this.worker.postMessage({
                type: 'generateChunkBatch',
                data: { requests },
                id: this.messageId++
            });
        } else {
            // 폴백: 동기 생성
            console.log(`동기 모드로 청크 생성 중: ${requests.length}개`);
            for (let req of requests) {
                try {
                    const chunk = this.createChunkGeometry(req.chunkX, req.chunkY, req.chunkZ);
                    const key = this.getChunkKey(req.chunkX, req.chunkY, req.chunkZ);
                    
                    if (chunk.isEmpty) {
                        this.emptyChunks.add(key);
                    } else {
                        this.chunks.set(key, chunk);
                    }
                    
                    this.generatingChunks.delete(key);
                } catch (e) {
                    console.warn('청크 생성 오류:', e);
                }
            }
        }
    }

    // 활성 청크들을 하나의 버퍼로 합치기
    mergeActiveChunks() {
        // 변경이 없으면 건너뛰기
        if (this.setsEqual(this.activeChunks, this.lastActiveChunks)) {
            return;
        }

        this.vertices = [];
        this.colors = [];
        this.normals = [];
        this.indices = [];

        let vertexOffset = 0;
        
        // 카메라 위치를 기준점으로 사용 (부동소수점 정밀도 문제 해결)
        const cameraPos = window.camera ? window.camera.getPosition() : [0, 0, 0];
        const offsetX = Math.floor(cameraPos[0] / 100) * 100;
        const offsetY = Math.floor(cameraPos[1] / 100) * 100;

        for (let key of this.activeChunks) {
            const chunk = this.chunks.get(key);
            if (!chunk) continue;

            // 정점 추가 (카메라 기준 상대 좌표)
            for (let i = 0; i < chunk.vertices.length; i += 3) {
                this.vertices.push(
                    chunk.vertices[i] - offsetX,
                    chunk.vertices[i + 1] - offsetY,
                    chunk.vertices[i + 2]
                );
            }
            
            // 색상, 법선 추가
            this.colors.push(...chunk.colors);
            this.normals.push(...chunk.normals);

            // 인덱스 추가 (오프셋 적용)
            for (let index of chunk.indices) {
                this.indices.push(index + vertexOffset);
            }

            vertexOffset += chunk.vertices.length / 3;
        }
        
        // 카메라 오프셋 저장 (렌더러에서 사용)
        this.cameraOffset = [offsetX, offsetY, 0];
        
        // 현재 활성 청크들을 저장하여 다음 비교에 사용
        this.lastActiveChunks = new Set(this.activeChunks);
        
        console.log(`청크 병합 완료: ${this.activeChunks.size}개 청크, 정점 ${this.vertices.length/3}개, 인덱스 ${this.indices.length}개`);
    }

    // 현재 지형 데이터 반환
    getTerrainData() {
        return {
            vertices: this.vertices,
            colors: this.colors,
            normals: this.normals,
            indices: this.indices,
            cameraOffset: this.cameraOffset || [0, 0, 0]
        };
    }

    // 멀리 있는 청크들 제거
    removeDistantChunks(cameraX, cameraY, cameraZ) {
        const centerChunk = this.worldToChunk(cameraX, cameraY, cameraZ);
        const keysToRemove = [];
        const maxDistance = this.generateDistance + 2; // 생성 범위보다 조금 더 넓게
        
        for (let key of this.chunks.keys()) {
            const [chunkX, chunkY, chunkZ] = key.split(',').map(Number);
            const dx = chunkX - centerChunk.x;
            const dy = chunkY - centerChunk.y;
            const dz = chunkZ - centerChunk.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // 최대 거리를 벗어난 청크들 제거
            if (distance > maxDistance) {
                keysToRemove.push(key);
            }
        }
        
        // 제거 실행
        for (let key of keysToRemove) {
            this.chunks.delete(key);
            this.generatingChunks.delete(key);
            this.emptyChunks.delete(key);
            this.chunkBuffers.delete(key);
        }
        
        if (keysToRemove.length > 0) {
            console.log(`멀리 있는 청크 ${keysToRemove.length}개 제거됨`);
        }
    }

    // 메모리 정리 (더 공격적인 청크 제거)
    cleanup() {
        const maxCachedChunks = 50; // 캐시 제한 대폭 축소 (500 → 50)
        
        if (this.chunks.size > maxCachedChunks) {
            const keysToRemove = [];
            let count = 0;
            
            // 활성 청크가 아닌 것들 우선 제거
            for (let key of this.chunks.keys()) {
                if (!this.activeChunks.has(key)) {
                    keysToRemove.push(key);
                    count++;
                    if (count >= this.chunks.size - maxCachedChunks) break;
                }
            }
            
            // 제거 실행
            for (let key of keysToRemove) {
                this.chunks.delete(key);
                this.generatingChunks.delete(key);
                this.emptyChunks.delete(key);
                this.chunkBuffers.delete(key);
            }
            
            console.log(`메모리 정리: ${keysToRemove.length}개 청크 제거`);
        }
    }

    // LOD 제거 - 모든 청크 동일 해상도 사용
    getChunkResolution() {
        return this.chunkResolution; // 모든 청크 동일 해상도
    }

    // 지형 충돌 감지를 위한 높이 보간
    getInterpolatedHeight(x, y) {
        if (this.equations.length === 0) return 0;
        
        // 주변 4개 점의 높이를 선형 보간
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = x1 + 1;
        const y2 = y1 + 1;
        
        const fx = x - x1;
        const fy = y - y1;
        
        const h11 = this.getHeightAt(x1 * this.scale, y1 * this.scale);
        const h21 = this.getHeightAt(x2 * this.scale, y1 * this.scale);
        const h12 = this.getHeightAt(x1 * this.scale, y2 * this.scale);
        const h22 = this.getHeightAt(x2 * this.scale, y2 * this.scale);
        
        const h1 = h11 * (1 - fx) + h21 * fx;
        const h2 = h12 * (1 - fx) + h22 * fx;
        
        return h1 * (1 - fy) + h2 * fy;
    }

    getNormalAt(x, y) {
        if (this.equations.length === 0) return [0, 0, 1];

        const scale = this.scale;
        const offset = 0.1; // A small offset for sampling

        // 주변 4점의 높이 샘플링
        const hL = this.getHeightAt((x - offset) * scale, y * scale); // 왼쪽
        const hR = this.getHeightAt((x + offset) * scale, y * scale); // 오른쪽
        const hD = this.getHeightAt(x * scale, (y - offset) * scale); // 아래
        const hU = this.getHeightAt(x * scale, (y + offset) * scale); // 위

        // 편미분을 이용한 법선 계산
        const dx = (hR - hL) / (2 * offset);
        const dy = (hU - hD) / (2 * offset);

        const normal = [-dx, -dy, 1];
        
        // 정규화
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        }

        return normal;
    }

    // 성능 매개변수 동적 조정
    adjustPerformanceSettings(settings) {
        if (settings.chunkUpdateThreshold !== undefined) {
            this.chunkUpdateThreshold = settings.chunkUpdateThreshold;
        }
        if (settings.chunksPerFrame !== undefined) {
            this.chunksPerFrame = settings.chunksPerFrame;
        }
        if (settings.viewDistance !== undefined) {
            this.viewDistance = settings.viewDistance;
        }
        if (settings.generateDistance !== undefined) {
            this.generateDistance = settings.generateDistance;
        }
        console.log('성능 설정 업데이트:', settings);
    }

    // 지형 강제 업데이트
    forceTerrainUpdate(cameraX, cameraY, cameraZ) {
        this.terrainDirty = true;
        this.scheduleChunkUpdate(cameraX, cameraY, cameraZ);
    }

    // 성능 통계 반환
    getPerformanceStats() {
        return {
            activeChunks: this.activeChunks.size,
            totalChunks: this.chunks.size,
            emptyChunks: this.emptyChunks.size,
            generatingChunks: this.generatingChunks.size,
            pendingUpdates: this.pendingChunkUpdates.length,
            chunkUpdateThreshold: this.chunkUpdateThreshold,
            chunksPerFrame: this.chunksPerFrame,
            viewDistance: this.viewDistance,
            generateDistance: this.generateDistance,
            verticalChunks: this.verticalChunks
        };
    }
}

// 전역 인스턴스 생성
window.terrainGenerator = new TerrainGenerator(); 