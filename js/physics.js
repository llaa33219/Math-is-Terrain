class PhysicsEngine {
    constructor() {
        this.gravity = -20.0;
        this.groundFriction = 0.9;
        this.airFriction = 0.99; // 공중에서는 마찰 적음
        this.airControl = 0.1; // 공중에서 제한된 컨트롤
        
        // 플레이어 물리 상태
        this.player = {
            position: [0, 0, 5],
            velocity: [0, 0, 0],
            acceleration: [0, 0, 0],
            onGround: false,
            groundNormal: [0, 0, 1],
            mass: 1.0,
            radius: 0.5,
            jumpForce: 12.0,
            moveSpeed: 20.0, // 지상 이동 속도
            maxGroundSpeed: 15.0, // 지상 최대 속도
            groundHeight: 0,
            
            // 미끄러짐 상태
            isSliding: false,
            slideVelocity: [0, 0, 0]
        };
        
        this.lastTime = 0;
    }

    // 플레이어 위치 설정
    setPlayerPosition(x, y, z) {
        this.player.position[0] = x;
        this.player.position[1] = y;
        this.player.position[2] = z;
        this.player.velocity = [0, 0, 0];
        this.player.acceleration = [0, 0, 0];
    }

    // 플레이어에게 힘 적용
    applyForce(fx, fy, fz) {
        this.player.acceleration[0] += fx / this.player.mass;
        this.player.acceleration[1] += fy / this.player.mass;
        this.player.acceleration[2] += fz / this.player.mass;
    }

    // 점프
    jump() {
        if (window.camera && window.camera.isCrouching) {
            return;
        }
        
        if (this.player.onGround && !this.player.isSliding) {
            this.player.velocity[2] = this.player.jumpForce;
            this.player.onGround = false;
        }
    }

    // 이동 입력 처리
    processMovementInput(moveX, moveY, deltaTime) {
        // 지상과 공중에서 다른 처리
        if (this.player.onGround) {
            // 지상: 법선에 따른 이동
            const speed = this.player.moveSpeed;
            
            // 지면에 평행한 이동 방향 계산
            const normal = this.player.groundNormal;
            const right = [moveX, moveY, 0];
            
            // 법선과 수직인 평면에 투영
            const dot = right[0] * normal[0] + right[1] * normal[1] + right[2] * normal[2];
            const projected = [
                right[0] - normal[0] * dot,
                right[1] - normal[1] * dot,
                right[2] - normal[2] * dot
            ];
            
            // 이동력 적용
            this.applyForce(projected[0] * speed, projected[1] * speed, projected[2] * speed);
        } else {
            // 공중: 제한된 컨트롤
            const airSpeed = this.player.moveSpeed * this.airControl;
            this.applyForce(moveX * airSpeed, moveY * airSpeed, 0);
        }
    }

    // 물리 시뮬레이션 업데이트
    update(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        const dt = Math.min(deltaTime * 0.001, 0.033);
        if (dt <= 0) return;
        
        // 중력 적용
        this.applyForce(0, 0, this.gravity);
        
        // 속도 업데이트 (가속도 적분)
        this.player.velocity[0] += this.player.acceleration[0] * dt;
        this.player.velocity[1] += this.player.acceleration[1] * dt;
        this.player.velocity[2] += this.player.acceleration[2] * dt;
        
        // 마찰 적용 (지상/공중 구분)
        if (this.player.onGround) {
            this.player.velocity[0] *= this.groundFriction;
            this.player.velocity[1] *= this.groundFriction;
        } else {
            this.player.velocity[0] *= this.airFriction;
            this.player.velocity[1] *= this.airFriction;
            this.player.velocity[2] *= this.airFriction;
        }
        
        // 충돌 처리를 포함한 위치 업데이트
        this.resolveCollisionsAndMove(dt);
        
        // 가속도 초기화
        this.player.acceleration = [0, 0, 0];
    }

    // 새로운 충돌 해결 및 이동 메서드
    resolveCollisionsAndMove(dt) {
        const pos = this.player.position;
        const vel = this.player.velocity;

        // 1. 다음 위치 예측
        let nextPos = [
            pos[0] + vel[0] * dt,
            pos[1] + vel[1] * dt,
            pos[2] + vel[2] * dt
        ];

        // 2. 다음 위치에서의 지형 정보 가져오기
        let terrainHeight = 0;
        let terrainNormal = [0, 0, 1];
        try {
            terrainHeight = window.terrainGenerator.getInterpolatedHeight(nextPos[0], nextPos[1]);
            terrainNormal = window.terrainGenerator.getNormalAt(nextPos[0], nextPos[1]);
        } catch (e) {
            console.warn('지형 데이터 계산 오류:', e);
        }

        const playerBottom = nextPos[2] - this.player.radius;
        const penetration = terrainHeight - playerBottom;
        
        // 3. 충돌 감지 및 해결
        if (penetration > -0.1) { // 지면 근처
            // 위치 보정
            nextPos[2] = terrainHeight + this.player.radius;
            
            // 지면 충돌 시 수직 속도 처리
            if (vel[2] < 0) {
                vel[2] = 0;
            }
            
            this.player.onGround = true;
            this.player.groundNormal = terrainNormal;
            
            // 경사도 확인 (70도 이상이면 미끄러짐)
            const slopeDot = terrainNormal[2];
            const slopeAngle = Math.acos(slopeDot) * 180 / Math.PI;
            
            if (slopeAngle > 70) {
                // 미끄러짐 처리
                this.player.isSliding = true;
                
                // 중력을 경사면 방향으로 변환
                const slideForce = this.gravity * (1.0 - slopeDot) * 0.5;
                const slideDir = [
                    terrainNormal[0] * slideForce,
                    terrainNormal[1] * slideForce,
                    0
                ];
                
                // 미끄러짐 속도 적용
                vel[0] += slideDir[0] * dt;
                vel[1] += slideDir[1] * dt;
            } else {
                this.player.isSliding = false;
            }
            
        } else {
            // 공중
            this.player.onGround = false;
            this.player.isSliding = false;
        }

        // 4. 최종 위치 업데이트
        this.player.position = nextPos;
        this.player.velocity = vel;
        this.player.groundHeight = terrainHeight;
    }

    // 플레이어 위치 반환
    getPlayerPosition() {
        return [...this.player.position];
    }

    // 플레이어 속도 반환
    getPlayerVelocity() {
        return [...this.player.velocity];
    }

    // 플레이어가 지면에 있는지 확인
    isOnGround() {
        return this.player.onGround;
    }

    // 지면 높이 반환
    getGroundHeight() {
        return this.player.groundHeight;
    }

    // 레이캐스팅 (선택적 기능)
    raycast(origin, direction, maxDistance = 100) {
        const step = 0.1;
        const steps = Math.floor(maxDistance / step);
        
        for (let i = 0; i < steps; i++) {
            const distance = i * step;
            const x = origin[0] + direction[0] * distance;
            const y = origin[1] + direction[1] * distance;
            const z = origin[2] + direction[2] * distance;
            
            const terrainHeight = window.terrainGenerator.getInterpolatedHeight(x, y);
            
            if (z <= terrainHeight) {
                return {
                    hit: true,
                    point: [x, y, terrainHeight],
                    distance: distance,
                    normal: [0, 0, 1] // 임시 법선
                };
            }
        }
        
        return { hit: false };
    }

    // 물리 시뮬레이션 리셋
    reset() {
        this.player.velocity = [0, 0, 0];
        this.player.acceleration = [0, 0, 0];
        this.player.onGround = false;
        this.player.isSliding = false;
        this.lastTime = 0;
    }

    // 디버그 정보 반환
    getDebugInfo() {
        return {
            position: this.player.position.map(v => v.toFixed(2)),
            velocity: this.player.velocity.map(v => v.toFixed(2)),
            onGround: this.player.onGround,
            isSliding: this.player.isSliding,
            groundHeight: this.player.groundHeight.toFixed(2),
            speed: Math.sqrt(
                this.player.velocity[0] ** 2 + 
                this.player.velocity[1] ** 2 + 
                this.player.velocity[2] ** 2
            ).toFixed(2)
        };
    }
}

// 전역 인스턴스 생성
window.physicsEngine = new PhysicsEngine(); 