class FirstPersonCamera {
    constructor() {
        this.position = [0, 0, 5];
        this.rotation = [0, 0]; // [pitch, yaw] in radians
        this.fov = Math.PI / 4; // 45도
        this.near = 0.1;
        this.far = 1000.0;
        
        // 카메라 설정
        this.mouseSensitivity = 0.003; // 마우스 감도 증가
        this.maxPitch = Math.PI / 2 - 0.1; // 90도 근처까지
        this.minPitch = -Math.PI / 2 + 0.1;
        
        // 입력 상태
        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseLocked = false;
        
        // 벡터 계산용
        this.forward = [0, 0, 0];
        this.right = [0, 0, 0];
        this.up = [0, 0, 1];
        
        // 웅크리기 상태
        this.isCrouching = false;
        this.normalHeight = 1.7;
        this.crouchHeight = 1.0;
        this.currentHeight = this.normalHeight;
        this.crouchSpeed = 8.0; // 웅크리기 속도
        
        // 카메라 흔들림 효과 (현실적 구현)
        this.shake = {
            offset: [0, 0, 0],
            rotationOffset: [0, 0, 0], // pitch, yaw, roll
            
            // 걷기 효과
            walkBob: {
                time: 0,
                stepTime: 0,
                lastStepTime: 0,
                stepCount: 0,
                stepInterval: 0.6, // 걸음 간격
                intensity: 1.0,
                headBob: 0.03,
                sideSway: 0.02,
                rollAmount: 0.8 // 도 단위
            },
            
            // 뛰기 효과  
            runBob: {
                time: 0,
                stepTime: 0,
                lastStepTime: 0,
                stepCount: 0,
                stepInterval: 0.45, // 조금 더 느린 걸음
                intensity: 1.0,
                headBob: 0.035, // 흔들림 강도 감소
                sideSway: 0.02, // 좌우 흔들림 감소
                rollAmount: 0.8, // roll 효과 감소
                bounce: 0.05 // 바운스 감소
            },
            
            // 점프 효과
            jumpShake: {
                active: false,
                phase: 'launch', // launch, airborne, landing
                time: 0,
                duration: 0.15,
                intensity: 0.0,
                recoil: 0.1
            },
            
            // 착지 효과
            landShake: {
                active: false,
                time: 0,
                duration: 0.4,
                intensity: 0.0,
                impact: 0.0,
                recovery: 0.0
            }
        };
        
        // 물리 상태 추적
        this.wasOnGround = false;
        this.wasJumping = false;
        
        this.setupEventListeners();
        this.updateVectors();
    }

    setupEventListeners() {
        // 키보드 이벤트
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            
            // 점프
            if (e.code === 'Space') {
                e.preventDefault();
                window.physicsEngine.jump();
                this.triggerJumpShake();
            }
            
            // 웅크리기 (C 키)
            if (e.code === 'KeyC') {
                e.preventDefault();
                this.toggleCrouch();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // 마우스 이벤트
        document.addEventListener('mousemove', (e) => {
            if (this.mouseLocked) {
                this.rotation[1] -= e.movementX * this.mouseSensitivity; // yaw
                this.rotation[0] -= e.movementY * this.mouseSensitivity; // pitch
                
                // Pitch 제한
                this.rotation[0] = Math.max(this.minPitch, Math.min(this.maxPitch, this.rotation[0]));
                
                this.updateVectors();
            }
        });

        // 포인터 락 이벤트
        document.addEventListener('pointerlockchange', () => {
            this.mouseLocked = document.pointerLockElement !== null;
        });

        // 게임 중일 때만 클릭으로 포인터 락 요청
        document.addEventListener('click', (e) => {
            // 게임 캔버스가 표시되고 메뉴가 숨겨져 있을 때만 포인터 락 요청
            const gameContainer = document.getElementById('game-container');
            const mainMenu = document.getElementById('main-menu');
            
            if (!this.mouseLocked && 
                !gameContainer.classList.contains('hidden') && 
                mainMenu.classList.contains('hidden')) {
                document.body.requestPointerLock();
            }
        });
    }

    // 방향 벡터 업데이트
    updateVectors() {
        const pitch = this.rotation[0];
        const yaw = this.rotation[1];
        
        // Forward 벡터 계산
        this.forward[0] = Math.cos(pitch) * Math.cos(yaw);
        this.forward[1] = Math.cos(pitch) * Math.sin(yaw);
        this.forward[2] = Math.sin(pitch);
        
        // Right 벡터 계산 (forward × up)
        this.right[0] = Math.sin(yaw);
        this.right[1] = -Math.cos(yaw);
        this.right[2] = 0;
        
        // 벡터 정규화
        this.normalizeVector(this.forward);
        this.normalizeVector(this.right);
    }

    // 벡터 정규화
    normalizeVector(vec) {
        const length = Math.sqrt(vec[0] ** 2 + vec[1] ** 2 + vec[2] ** 2);
        if (length > 0) {
            vec[0] /= length;
            vec[1] /= length;
            vec[2] /= length;
        }
    }

    // 입력 처리 및 이동
    update(deltaTime) {
        let moveForward = 0;
        let moveRight = 0;
        
        // 이동 키 처리
        if (this.keys['KeyW']) moveForward += 1;
        if (this.keys['KeyS']) moveForward -= 1;
        if (this.keys['KeyD']) moveRight += 1;
        if (this.keys['KeyA']) moveRight -= 1;
        
        // 대각선 이동 보정
        if (moveForward !== 0 && moveRight !== 0) {
            const factor = 1 / Math.sqrt(2);
            moveForward *= factor;
            moveRight *= factor;
        }
        
        // 달리기 (Shift) - 웅크리기 중에는 달리기 불가
        const isRunning = this.keys['ShiftLeft'] && !this.isCrouching;
        let speedMultiplier = isRunning ? 2.0 : 1.0;
        
        // 웅크리기 중 속도 감소
        if (this.isCrouching) {
            speedMultiplier *= 0.6;
        }
        
        moveForward *= speedMultiplier;
        moveRight *= speedMultiplier;
        
        // 카메라 방향 기반 이동 벡터 계산
        const forwardVector = [
            Math.cos(this.rotation[1]) * Math.cos(this.rotation[0]),
            Math.sin(this.rotation[1]) * Math.cos(this.rotation[0]),
            0 // 수평 이동만
        ];
        
        const rightVector = [
            Math.sin(this.rotation[1]),
            -Math.cos(this.rotation[1]),
            0
        ];
        
        // 최종 이동 방향 계산
        const moveX = forwardVector[0] * moveForward + rightVector[0] * moveRight;
        const moveY = forwardVector[1] * moveForward + rightVector[1] * moveRight;
        
        // 물리 엔진에 이동 입력 전달
        window.physicsEngine.processMovementInput(moveX, moveY, deltaTime);
        
        // 웅크리기 높이 업데이트
        this.updateCrouchHeight(deltaTime);
        
        // 카메라 흔들림 업데이트
        this.updateCameraShake(deltaTime, moveX, moveY, isRunning);
        
        // 착지 감지
        this.checkLanding();
        
        // 플레이어 위치 동기화
        const playerPos = window.physicsEngine.getPlayerPosition();
        this.position[0] = playerPos[0];
        this.position[1] = playerPos[1];
        this.position[2] = playerPos[2] + this.currentHeight;
    }

    // 카메라 위치 설정
    setPosition(x, y, z) {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = z;
        
        // 물리 엔진에도 위치 설정
        window.physicsEngine.setPlayerPosition(x, y, z - 1.7);
    }

    // 카메라 회전 설정
    setRotation(pitch, yaw) {
        this.rotation[0] = pitch;
        this.rotation[1] = yaw;
        
        // Pitch 제한 적용
        this.rotation[0] = Math.max(this.minPitch, Math.min(this.maxPitch, this.rotation[0]));
        
        this.updateVectors();
    }

    // 뷰 행렬 생성 (흔들림 효과 포함)
    getViewMatrix(out) {
        // 흔들림 회전 적용
        const shakePitch = this.rotation[0] + this.shake.rotationOffset[0];
        const shakeYaw = this.rotation[1] + this.shake.rotationOffset[1];
        const shakeRoll = this.shake.rotationOffset[2];
        
        // 흔들림이 적용된 방향 벡터 계산
        const shakeForward = [
            Math.cos(shakePitch) * Math.cos(shakeYaw),
            Math.cos(shakePitch) * Math.sin(shakeYaw),
            Math.sin(shakePitch)
        ];
        
        const shakeRight = [
            Math.sin(shakeYaw),
            -Math.cos(shakeYaw),
            0
        ];
        
        // Roll 효과를 위한 Up 벡터 계산
        const shakeUp = [
            -Math.sin(shakeRoll) * shakeRight[0],
            -Math.sin(shakeRoll) * shakeRight[1],
            Math.cos(shakeRoll)
        ];
        
        const eye = [
            this.position[0] + this.shake.offset[0],
            this.position[1] + this.shake.offset[1],
            this.position[2] + this.shake.offset[2]
        ];
        
        const center = [
            eye[0] + shakeForward[0],
            eye[1] + shakeForward[1],
            eye[2] + shakeForward[2]
        ];
        
        return mat4.lookAt(out, eye, center, shakeUp);
    }

    // 카메라 위치 반환
    getPosition() {
        return [...this.position];
    }

    // 카메라 방향 반환
    getForward() {
        return [...this.forward];
    }

    // 카메라 오른쪽 벡터 반환
    getRight() {
        return [...this.right];
    }

    // 카메라 회전 반환
    getRotation() {
        return [...this.rotation];
    }

    // 마우스 감도 설정
    setMouseSensitivity(sensitivity) {
        this.mouseSensitivity = sensitivity;
    }

    // FOV 설정
    setFOV(fov) {
        this.fov = fov;
    }

    // 카메라 리셋
    reset() {
        this.rotation = [0, 0];
        this.updateVectors();
    }

    // 특정 지점을 바라보도록 설정
    lookAt(target) {
        const dx = target[0] - this.position[0];
        const dy = target[1] - this.position[1];
        const dz = target[2] - this.position[2];
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance > 0) {
            this.rotation[0] = Math.asin(dz / distance); // pitch
            this.rotation[1] = Math.atan2(dy, dx); // yaw
            
            // Pitch 제한 적용
            this.rotation[0] = Math.max(this.minPitch, Math.min(this.maxPitch, this.rotation[0]));
            
            this.updateVectors();
        }
    }

    // 웅크리기 토글
    toggleCrouch() {
        this.isCrouching = !this.isCrouching;
    }
    
    // 웅크리기 높이 업데이트
    updateCrouchHeight(deltaTime) {
        const targetHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
        const heightDiff = targetHeight - this.currentHeight;
        
        if (Math.abs(heightDiff) > 0.01) {
            this.currentHeight += heightDiff * this.crouchSpeed * deltaTime;
            this.currentHeight = Math.max(this.crouchHeight, Math.min(this.normalHeight, this.currentHeight));
        }
    }
    
    // 점프 흔들림 트리거 (비활성화)
    triggerJumpShake() {
        // 점프 시작 흔들림 제거 - 착지 시만 흔들림 적용
        this.wasJumping = true;
    }
    
    // 착지 감지
    checkLanding() {
        const isOnGround = window.physicsEngine.isOnGround();
        const velocity = window.physicsEngine.getPlayerVelocity();
        
        if (!this.wasOnGround && isOnGround && this.wasJumping) {
            // 착지 시 충격 흔들림 - 낙하 속도에 따라 강도 조절
            const fallSpeed = Math.abs(velocity[2]);
            const landingIntensity = Math.min(fallSpeed * 0.12, 0.8); // 강도 조절
            
            // 최소 낙하 속도 임계값 설정 (너무 작은 점프는 흔들림 없음)
            if (fallSpeed > 3.0) {
                this.shake.landShake.active = true;
                this.shake.landShake.time = 0;
                this.shake.landShake.intensity = landingIntensity;
                this.shake.landShake.impact = landingIntensity;
                this.shake.landShake.recovery = 0;
            }
            
            this.wasJumping = false;
        }
        
        this.wasOnGround = isOnGround;
    }
    
    // 카메라 흔들림 업데이트 (현실적 구현)
    updateCameraShake(deltaTime, moveX, moveY, isRunning) {
        // 흔들림 오프셋 초기화
        this.shake.offset[0] = 0;
        this.shake.offset[1] = 0;
        this.shake.offset[2] = 0;
        this.shake.rotationOffset[0] = 0; // pitch
        this.shake.rotationOffset[1] = 0; // yaw
        this.shake.rotationOffset[2] = 0; // roll
        
        const isMoving = Math.abs(moveX) > 0.1 || Math.abs(moveY) > 0.1;
        const isOnGround = window.physicsEngine.isOnGround();
        
        // 걷기/뛰기 흔들림
        if (isMoving && isOnGround) {
            this.updateMovementShake(deltaTime, isRunning);
        }
        
        // 착지 흔들림만 적용
        if (this.shake.landShake.active) {
            this.updateLandShake(deltaTime);
        }
    }
    
    // 이동 흔들림 (걷기/뛰기)
    updateMovementShake(deltaTime, isRunning) {
        const bobData = isRunning ? this.shake.runBob : this.shake.walkBob;
        
        // 실제 플레이어 속도 반영
        const velocity = window.physicsEngine.getPlayerVelocity();
        const horizontalSpeed = Math.sqrt(velocity[0] * velocity[0] + velocity[1] * velocity[1]);
        const speedMultiplier = Math.min(horizontalSpeed / 8.0, 1.0); // 속도 민감도 감소
        
        bobData.time += deltaTime;
        bobData.stepTime += deltaTime;
        
        // 발걸음 사이클 계산
        const stepCycle = bobData.stepTime / bobData.stepInterval;
        const stepPhase = stepCycle % 1.0;
        
        // 발걸음 감지 (발이 땅에 닿는 순간)
        if (stepPhase < 0.1 && bobData.stepTime - bobData.lastStepTime > bobData.stepInterval * 0.8) {
            bobData.stepCount++;
            bobData.lastStepTime = bobData.stepTime;
            
            // 발걸음 순간 충격 (속도에 비례)
            const stepImpact = (isRunning ? 0.02 : 0.012) * speedMultiplier;
            this.shake.offset[2] -= stepImpact;
            
            // 발걸음 시 미묘한 좌우 흔들림
            const stepSway = (Math.random() - 0.5) * 0.002 * speedMultiplier;
            this.shake.offset[0] += stepSway;
        }
        
        // 머리 흔들림 (리듬감 있는 사인파)
        const headBobFreq = 2 * Math.PI / bobData.stepInterval;
        const headBobAmount = Math.sin(bobData.stepTime * headBobFreq) * bobData.headBob * bobData.intensity * speedMultiplier;
        this.shake.offset[2] += headBobAmount;
        
        // 좌우 체중 이동 (발걸음에 맞춰)
        const sideSwayFreq = headBobFreq * 0.5; // 절반 주파수
        const sideSwayAmount = Math.sin(bobData.stepTime * sideSwayFreq) * bobData.sideSway * bobData.intensity * speedMultiplier;
        this.shake.offset[0] += sideSwayAmount;
        
        // 앞뒤 흔들림 (미묘한 효과)
        const frontBackAmount = Math.sin(bobData.stepTime * headBobFreq * 0.3) * bobData.headBob * 0.25 * speedMultiplier;
        this.shake.offset[1] += frontBackAmount;
        
        // 머리 roll 효과 (걸을 때 자연스러운 기울임)
        const rollAmount = Math.sin(bobData.stepTime * sideSwayFreq) * bobData.rollAmount * bobData.intensity * speedMultiplier;
        this.shake.rotationOffset[2] += rollAmount * Math.PI / 180; // 도를 라디안으로 변환
        
        // 미묘한 pitch 변화 (걷기 리듬)
        const pitchAmount = Math.sin(bobData.stepTime * headBobFreq * 0.7) * 0.2 * speedMultiplier;
        this.shake.rotationOffset[0] += pitchAmount * Math.PI / 180;
        
        // 추가 바운스 (뛰기 시)
        if (isRunning) {
            const bounceAmount = Math.sin(bobData.stepTime * headBobFreq * 1.5) * bobData.bounce * bobData.intensity * speedMultiplier;
            this.shake.offset[2] += bounceAmount;
            
            // 뛰기 시 앞뒤 흔들림 (감소)
            const runBobAmount = Math.sin(bobData.stepTime * headBobFreq * 1.2) * 0.008 * speedMultiplier;
            this.shake.offset[1] += runBobAmount;
            
            // 뛰기 시 roll 효과 (감소)
            const runRollAmount = Math.sin(bobData.stepTime * headBobFreq * 1.1) * 0.5 * speedMultiplier;
            this.shake.rotationOffset[2] += runRollAmount * Math.PI / 180;
        }
    }
    

    
    // 착지 흔들림 (충격 시에만)
    updateLandShake(deltaTime) {
        const landShake = this.shake.landShake;
        landShake.time += deltaTime;
        
        const progress = landShake.time / landShake.duration;
        
        if (progress < 0.15) {
            // 착지 순간 - 강한 충격
            const impactIntensity = landShake.impact * (1 - progress * 6.67);
            this.shake.offset[2] -= impactIntensity * 0.08;
            this.shake.rotationOffset[0] += Math.sin(landShake.time * 35) * 0.06 * impactIntensity;
            this.shake.rotationOffset[2] += Math.sin(landShake.time * 30) * 0.04 * impactIntensity;
            
        } else if (progress < 0.5) {
            // 충격 후 진동
            const vibrationProgress = (progress - 0.15) / 0.35;
            const vibrationIntensity = landShake.impact * (1 - vibrationProgress) * 0.4;
            
            this.shake.offset[0] += Math.sin(landShake.time * 20) * 0.015 * vibrationIntensity;
            this.shake.offset[1] += Math.sin(landShake.time * 18) * 0.01 * vibrationIntensity;
            this.shake.offset[2] += Math.sin(landShake.time * 25) * 0.02 * vibrationIntensity;
            
        } else {
            // 회복 단계 - 점진적 안정화
            const recoveryProgress = (progress - 0.5) / 0.5;
            const recoveryIntensity = landShake.impact * (1 - recoveryProgress) * 0.15;
            
            this.shake.offset[2] += Math.sin(landShake.time * 12) * 0.008 * recoveryIntensity;
            this.shake.rotationOffset[0] += Math.sin(landShake.time * 10) * 0.015 * recoveryIntensity;
        }
        
        // 착지 효과 종료
        if (progress >= 1.0) {
            landShake.active = false;
        }
    }

    // 디버그 정보 반환
    getDebugInfo() {
        return {
            position: this.position.map(v => v.toFixed(2)),
            rotation: [
                (this.rotation[0] * 180 / Math.PI).toFixed(1),
                (this.rotation[1] * 180 / Math.PI).toFixed(1)
            ],
            forward: this.forward.map(v => v.toFixed(3)),
            mouseLocked: this.mouseLocked,
            isCrouching: this.isCrouching,
            currentHeight: this.currentHeight.toFixed(2),
            shake: {
                offset: this.shake.offset.map(v => v.toFixed(3)),
                rotationOffset: this.shake.rotationOffset.map(v => (v * 180 / Math.PI).toFixed(1)),
                landActive: this.shake.landShake.active
            }
        };
    }
}

// 전역 인스턴스 생성
window.camera = new FirstPersonCamera(); 