// math.js 라이브러리 import
importScripts('math.min.js');

// 지형 생성 웹 워커
class TerrainWorker {
    constructor() {
        this.equations = [];
        this.chunkSize = 25;
        this.chunkResolution = 60;
        this.chunkHeight = 50; // 수직 청크 높이
        this.scale = 1.0; // X, Y, Z 모두 동일한 스케일
        
        // math.js 스코프 생성
        this.mathScope = {
            x: 0,
            y: 0,
            z: 0,
            
            // 추가 함수들
            mod: (a, b) => {
                if (b === 0) {
                    console.warn('Worker mod: Division by zero, returning 0');
                    return 0;
                }
                return a % b;
            },
            fract: (x) => x - Math.floor(x),
            clamp: (x, min, max) => Math.max(min, Math.min(max, x)),
            lerp: (a, b, t) => a + t * (b - a),
            step: (edge, x) => x < edge ? 0 : 1,
            smoothstep: (edge0, edge1, x) => {
                const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
                return t * t * (3 - 2 * t);
            }
        };
    }

    // 수식 설정
    setEquations(equationsData) {
        console.log('Worker: Setting equations:', equationsData);
        this.equations = equationsData.map(eq => {
            try {
                console.log(`Worker: Compiling equation: "${eq.compiledCode}"`);
                
                // math.js로 표현식 컴파일
                const compiledExpr = math.compile(eq.compiledCode);
                
                // 테스트 실행
                const testResult = compiledExpr.evaluate({ ...this.mathScope, x: 0, y: 0, z: 0 });
                console.log(`Worker: Test result for (0,0,0): ${testResult}`);
                const testResult2 = compiledExpr.evaluate({ ...this.mathScope, x: 4, y: 0, z: 0 });
                console.log(`Worker: Test result for (4,0,0): ${testResult2}`);
                
                return {
                    function: (x, y, z) => {
                        try {
                            const result = compiledExpr.evaluate({ ...this.mathScope, x, y, z });
                            
                            if (!isFinite(result)) {
                                console.warn('Worker: Invalid result:', result, 'for input:', x, y, z);
                                return 0;
                            }
                            return result;
                        } catch (e) {
                            console.error('Worker: Function execution error:', e);
                            return 0;
                        }
                    },
                    color: eq.color
                };
            } catch (e) {
                console.warn('Worker: 수식 컴파일 오류:', e);
                return {
                    function: () => 0,
                    color: eq.color
                };
            }
        });
    }

    // 지형 높이 계산
    getHeightAt(x, y) {
        if (this.equations.length === 0) {
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
                // 오류 시 0 반환
            }
        }
        
        return totalHeight / this.equations.length;
    }

    // 색상 계산
    getColorAt(x, y, height) {
        if (this.equations.length === 0) return [0.5, 0.5, 0.5];
        
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

    // HEX to RGB 변환
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255
        ] : [0.5, 0.5, 0.5];
    }

    // 법선 계산
    calculateNormal(x, y, step) {
        const scale = this.scale;
        const offset = step * 0.5;

        const hL = this.getHeightAt((x - offset) * scale, y * scale);
        const hR = this.getHeightAt((x + offset) * scale, y * scale);
        const hD = this.getHeightAt(x * scale, (y - offset) * scale);
        const hU = this.getHeightAt(x * scale, (y + offset) * scale);

        const dx = (hR - hL) / (2 * offset);
        const dy = (hU - hD) / (2 * offset);

        const normal = [-dx, -dy, 1];
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        }

        return normal;
    }

    // 청크 생성
    generateChunk(chunkX, chunkY, chunkZ) {
        const resolution = this.chunkResolution;
        const size = this.chunkSize;
        const startX = chunkX * size;
        const startY = chunkY * size;
        const minHeight = chunkZ * this.chunkHeight;
        const maxHeight = (chunkZ + 1) * this.chunkHeight;
        const step = size / (resolution - 1);

        // 빈 청크 확인
        const hasContent = this.checkChunkHasContent(startX, startY, size, minHeight, maxHeight);
        if (!hasContent) {
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

        // 정점 생성 (스키트 포함)
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
                
                // 클램핑 제거 - 실제 높이 사용
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

    // 삼각형이 높이 범위와 교차하는지 확인
    triangleIntersectsRange(heights, minHeight, maxHeight) {
        const minTriHeight = Math.min(...heights);
        const maxTriHeight = Math.max(...heights);
        
        // 삼각형의 높이 범위가 청크 범위와 겹치는지 확인
        return maxTriHeight >= minHeight && minTriHeight <= maxHeight;
    }

    // 청크에 내용이 있는지 확인
    checkChunkHasContent(startX, startY, size, minHeight, maxHeight) {
        const sampleDensity = 4;
        const step = size / sampleDensity;
        
        for (let y = 0; y <= sampleDensity; y++) {
            for (let x = 0; x <= sampleDensity; x++) {
                const sampleX = startX + x * step;
                const sampleY = startY + y * step;
                const height = this.getHeightAt(sampleX * this.scale, sampleY * this.scale);
                
                if (height >= minHeight - 50 && height <= maxHeight + 50) {
                    return true;
                }
                
                if (!isFinite(height)) {
                    return true;
                }
            }
        }
        return false;
    }

    // 해상도 통일 - 모든 청크 동일 해상도
    getChunkResolution() {
        return this.chunkResolution; // 모든 청크 동일 해상도
    }

    // 경계 정점 보정
    getStitchedHeight(worldX, worldY, originalHeight, chunkX, chunkY, chunkZ, localX, localY, resolution) {
        const size = this.chunkSize;
        
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
}

// 워커 인스턴스
const terrainWorker = new TerrainWorker();

// 메시지 처리
self.onmessage = function(e) {
    const { type, data, id } = e.data;
    
    switch (type) {
        case 'setEquations':
            terrainWorker.setEquations(data);
            self.postMessage({ type: 'equationsSet', id });
            break;
            
        case 'generateChunk':
            const { chunkX, chunkY, chunkZ } = data;
            const chunk = terrainWorker.generateChunk(chunkX, chunkY, chunkZ);
            self.postMessage({ 
                type: 'chunkGenerated', 
                id,
                data: { chunkX, chunkY, chunkZ, chunk }
            });
            break;
            
        case 'generateChunkBatch':
            const results = [];
            for (let req of data.requests) {
                const chunk = terrainWorker.generateChunk(
                    req.chunkX, 
                    req.chunkY, 
                    req.chunkZ || 0
                );
                results.push({
                    chunkX: req.chunkX,
                    chunkY: req.chunkY,
                    chunkZ: req.chunkZ || 0,
                    chunk: chunk
                });
            }
            self.postMessage({
                type: 'chunkBatchGenerated',
                id,
                data: results
            });
            break;
    }
}; 