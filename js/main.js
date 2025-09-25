class MathTerrain {
    constructor() {
        this.canvas = null;
        this.renderer = null;
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.fpsCounter = 0;
        this.lastTerrainData = null; // 지형 데이터 변경 감지용
        
        this.cleanupInterval = null;
        
        this.init();
    }

    async init() {
        try {
            // 캔버스 초기화
            this.canvas = document.getElementById('game-canvas');
            if (!this.canvas) {
                throw new Error('게임 캔버스를 찾을 수 없습니다.');
            }

            // 렌더러 초기화
            this.renderer = new Renderer(this.canvas);
            
            console.log('렌더러 초기화 완료');
            
            // 렌더러를 전역으로 등록
            window.renderer = this.renderer;
            
            // UI 초기화 완료 알림
            window.uiManager.onInitializationComplete();
            
            // 정리 작업을 위한 인터벌 설정
            this.cleanupInterval = setInterval(() => {
                window.terrainGenerator.cleanup();
            }, 10000); // 10초마다 정리
            
            console.log('Math is Terrain 초기화 완료!');
        } catch (error) {
            console.error('초기화 오류:', error);
            window.uiManager.showError('애플리케이션을 초기화할 수 없습니다: ' + error.message);
        }
    }

    // 게임 시작
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.fpsCounter = performance.now();
        this.gameLoop();
        
        console.log('게임 시작!');
    }

    // 게임 정지
    stop() {
        this.isRunning = false;
        console.log('게임 정지!');
    }

    // 메인 게임 루프
    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // FPS 계산
        this.frameCount++;
        if (currentTime - this.fpsCounter >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.fpsCounter = currentTime;
        }

        try {
            this.update(currentTime, deltaTime);
            this.render();
        } catch (error) {
            console.error('게임 루프 오류:', error);
            this.stop();
            window.uiManager.showError('게임 실행 중 오류가 발생했습니다.');
            return;
        }

        requestAnimationFrame(() => this.gameLoop());
    }

    // 게임 상태 업데이트
    update(currentTime, deltaTime) {
        // 성능 모니터링 업데이트
        window.performanceMonitor.update(currentTime);
        
        // 물리 엔진 업데이트
        window.physicsEngine.update(currentTime);
        
        // 카메라 업데이트
        window.camera.update(deltaTime * 0.001);
        
        // 지형 업데이트 (더 이상 매 프레임마다 하지 않음)
        const cameraPos = window.camera.getPosition();
        window.terrainGenerator.updateChunks(cameraPos[0], cameraPos[1], cameraPos[2]);
        
        // 지형 데이터 업데이트 (필요할 때만)
        this.updateTerrainBuffers();
        
        // 정리 작업 (더 자주)
        if (currentTime % 2000 < 100) { // 2초마다 한 번 (5초 → 2초)
            window.terrainGenerator.cleanup();
        }
    }

    // 지형 버퍼 업데이트 최적화
    updateTerrainBuffers() {
        const terrainData = window.terrainGenerator.getTerrainData();
        
        // 지형 데이터가 변경되었을 때만 업데이트
        if (terrainData.vertices.length > 0) {
            // 이전 데이터와 비교하여 변경된 경우에만 업데이트
            if (!this.lastTerrainData || 
                this.lastTerrainData.vertices.length !== terrainData.vertices.length ||
                this.lastTerrainData.indices.length !== terrainData.indices.length) {
                
                this.renderer.updateTerrainBuffers(
                    terrainData.vertices,
                    terrainData.colors,
                    terrainData.normals,
                    terrainData.indices
                );
                
                this.lastTerrainData = {
                    vertices: terrainData.vertices,
                    indices: terrainData.indices
                };
                
                // 성능 통계 업데이트
                window.performanceMonitor.updateStats({
                    triangles: terrainData.indices.length / 3,
                    drawCalls: 1,
                    activeChunks: window.terrainGenerator.activeChunks.size,
                    totalChunks: window.terrainGenerator.chunks.size
                });
            }
        } else if (window.DEBUG) {
            // 디버깅: 지형 데이터가 없을 때 (디버그 모드에서만)
            console.log('지형 데이터 없음. 카메라 위치:', window.camera.getPosition());
            console.log('활성 청크 수:', window.terrainGenerator.activeChunks.size);
            console.log('총 청크 수:', window.terrainGenerator.chunks.size);
        }
    }

    // 렌더링
    render() {
        this.renderer.render(window.camera);
    }

    // 리사이즈 처리
    handleResize() {
        if (this.renderer) {
            this.renderer.resize();
        }
    }

    // 애플리케이션 종료
    destroy() {
        this.stop();
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        // 이벤트 리스너 정리
        window.removeEventListener('resize', this.handleResize.bind(this));
        
        console.log('Math is Terrain 종료됨');
    }

    // 디버그 정보 반환
    getDebugInfo() {
        return {
            fps: this.fps,
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            terrainChunks: window.terrainGenerator.chunks.size,
            activeChunks: window.terrainGenerator.activeChunks.size,
            physics: window.physicsEngine.getDebugInfo(),
            camera: window.camera.getDebugInfo()
        };
    }

    // FPS 반환
    getFPS() {
        return this.fps;
    }
}

// 애플리케이션 인스턴스 생성
let app;

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', async () => {
    app = new MathTerrain();
    
    // 리사이즈 이벤트 처리
    window.addEventListener('resize', () => {
        if (app) {
            app.handleResize();
        }
    });
    
    // 게임 시작/정지 전역 함수 등록
    window.startGame = () => {
        if (app) {
            app.start();
        }
    };
    
    window.stopGame = () => {
        if (app) {
            app.stop();
        }
    };
    
    // 디버그용 전역 함수
    window.getDebugInfo = () => {
        return app ? app.getDebugInfo() : null;
    };
    
    // 개발자 도구용 전역 변수
    window.DEBUG = false; // 디버그 모드
    window.app = app;
    
    // UI Manager가 완전히 로드될 때까지 대기
    await new Promise(resolve => {
        const checkUIManager = () => {
            if (window.uiManager) {
                resolve();
            } else {
                setTimeout(checkUIManager, 10);
            }
        };
        checkUIManager();
    });
    
    // UI 이벤트와 게임 로직 연결
    const originalStartGame = window.uiManager.startGame.bind(window.uiManager);
    window.uiManager.startGame = function() {
        originalStartGame();
        // 게임 루프 시작
        if (app && !app.isRunning) {
            app.start();
        }
    };
    
    // 메뉴로 돌아가기 시 게임 정지
    const originalShowMenu = window.uiManager.showMenu.bind(window.uiManager);
    window.uiManager.showMenu = function() {
        originalShowMenu();
        // 게임 루프 정지
        if (app && app.isRunning) {
            app.stop();
        }
    };
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (app) {
        app.destroy();
    }
});

// 에러 핸들링
window.addEventListener('error', (event) => {
    console.error('전역 오류:', event.error);
    if (window.uiManager) {
        window.uiManager.showError('예상치 못한 오류가 발생했습니다.');
    }
});

// 성능 모니터링 (개발용)
if (window.DEBUG) {
    setInterval(() => {
        const debugInfo = window.getDebugInfo();
        if (debugInfo) {
            console.log('Debug Info:', debugInfo);
        }
    }, 5000);
} 
