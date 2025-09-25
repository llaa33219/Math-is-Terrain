class PerformanceMonitor {
    constructor() {
        this.frameCount = 0;
        this.fps = 0;
        this.lastFPSUpdate = 0;
        this.frameTime = 0;
        this.lastFrameTime = 0;
        
        // 성능 통계
        this.stats = {
            triangles: 0,
            drawCalls: 0,
            activeChunks: 0,
            totalChunks: 0
        };
        
        this.initDisplay();
    }

    initDisplay() {
        if (!window.DEBUG) return;
        
        // 성능 표시 패널 생성
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.style.cssText = `
            position: fixed;
            top: 100px;
            left: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            pointer-events: none;
        `;
        document.body.appendChild(panel);
        this.panel = panel;
    }

    update(currentTime) {
        this.frameCount++;
        this.frameTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;

        // FPS 계산 (매초)
        if (currentTime - this.lastFPSUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFPSUpdate = currentTime;
            
            this.updateDisplay();
        }
    }

    updateStats(stats) {
        Object.assign(this.stats, stats);
    }

    updateDisplay() {
        if (!this.panel || !window.DEBUG) return;

        this.panel.innerHTML = `
            <div>FPS: ${this.fps}</div>
            <div>Frame Time: ${this.frameTime.toFixed(1)}ms</div>
            <div>Triangles: ${this.stats.triangles.toLocaleString()}</div>
            <div>Draw Calls: ${this.stats.drawCalls}</div>
            <div>Active Chunks: ${this.stats.activeChunks}</div>
            <div>Total Chunks: ${this.stats.totalChunks}</div>
        `;
    }

    getFPS() {
        return this.fps;
    }

    getFrameTime() {
        return this.frameTime;
    }

    // 성능 조정 권장사항
    getPerformanceRecommendations() {
        const recommendations = [];
        
        if (this.fps < 30) {
            recommendations.push("FPS가 낮습니다. 지형 해상도를 줄이거나 시야 거리를 단축하세요.");
        }
        
        if (this.frameTime > 33) {
            recommendations.push("프레임 시간이 깁니다. 렌더링 최적화가 필요합니다.");
        }
        
        if (this.stats.activeChunks > 50) {
            recommendations.push("활성 청크가 많습니다. 시야 거리를 줄이세요.");
        }
        
        return recommendations;
    }

    // 자동 성능 조정
    autoOptimize() {
        if (this.fps < 25) {
            // FPS가 너무 낮으면 자동으로 설정 조정
            if (window.terrainGenerator) {
                window.terrainGenerator.viewDistance = Math.max(2, window.terrainGenerator.viewDistance - 1);
                window.terrainGenerator.chunkResolution = Math.max(16, window.terrainGenerator.chunkResolution - 4);
                console.log('성능 최적화: 시야 거리와 해상도를 자동 조정했습니다.');
            }
        }
    }
}

// 전역 인스턴스 생성
window.performanceMonitor = new PerformanceMonitor(); 