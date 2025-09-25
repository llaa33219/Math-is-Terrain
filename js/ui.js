class UIManager {
    constructor() {
        this.presets = null;
        this.currentEquations = [];
        
        this.loadingScreen = document.getElementById('loading-screen');
        this.mainMenu = document.getElementById('main-menu');
        this.gameContainer = document.getElementById('game-container');
        
        this.presetSelect = document.getElementById('preset-select');
        this.loadPresetBtn = document.getElementById('load-preset-btn');
        this.equationsContainer = document.getElementById('equations-container');
        this.addEquationBtn = document.getElementById('add-equation-btn');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.startXInput = document.getElementById('start-x');
        this.startYInput = document.getElementById('start-y');
        this.startZInput = document.getElementById('start-z');
        
        // Environment settings elements
        this.environmentInputs = {
            skyColorTop: document.getElementById('sky-color-top'),
            skyColorHorizon: document.getElementById('sky-color-horizon'),
            sunColor: document.getElementById('sun-color'),
            sunIntensity: document.getElementById('sun-intensity'),
            ambientColor: document.getElementById('ambient-color'),
            ambientIntensity: document.getElementById('ambient-intensity'),
            fogColor: document.getElementById('fog-color'),
            fogDensity: document.getElementById('fog-density'),
            fogStart: document.getElementById('fog-start'),
            gamma: document.getElementById('gamma'),
            timeSpeed: document.getElementById('time-speed'),
            timePause: document.getElementById('time-pause')
        };
        

        
        this.setupEventListeners();
        this.loadPresets();
        this.addEquationInput('sin(x) + cos(y)', '#007bff'); // Add a default equation
        
        console.log('UIManager initialized');
    }

    setupEventListeners() {
        // Load Preset Button
        this.loadPresetBtn.addEventListener('click', () => {
            this.loadSelectedPreset();
        });

        // Add Equation Button
        this.addEquationBtn.addEventListener('click', () => {
            this.addEquationInput();
        });

        // Start Game Button
        this.startGameBtn.addEventListener('click', () => {
            this.startGame();
        });

        // ESC key to toggle menu
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                e.preventDefault();
                if (!this.mainMenu.classList.contains('hidden')) {
                    // Do nothing if menu is visible
                } else {
                    this.showMenu();
                }
            }
        });

        // Environment settings number input events
        ['sunIntensity', 'ambientIntensity', 'fogDensity', 'fogStart', 'gamma', 'timeSpeed'].forEach(key => {
            const input = this.environmentInputs[key];
            if (input) {
                input.addEventListener('input', () => {
                    this.updateEnvironmentSettings();
                });
            }
        });

        // Environment settings color events (handle both input and change)
        ['skyColorTop', 'skyColorHorizon', 'sunColor', 'ambientColor', 'fogColor'].forEach(key => {
            const input = this.environmentInputs[key];
            if (input) {
                input.addEventListener('input', () => {
                    this.updateEnvironmentSettings();
                });
                input.addEventListener('change', () => {
                    this.updateEnvironmentSettings();
                });
            }
        });

        // Time settings event
        if (this.environmentInputs.timePause) {
            this.environmentInputs.timePause.addEventListener('change', () => {
                this.updateEnvironmentSettings();
            });
        }
    }

    // Load preset data
    async loadPresets() {
        try {
            console.log('Loading presets...');
            const response = await fetch('data/presets.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.presets = await response.json();
            console.log('Preset data loaded:', this.presets);
            this.populatePresetSelect();
            console.log('Preset dropdown populated');
        } catch (error) {
            console.error('Failed to load presets:', error);
            this.showError('Could not load presets file: ' + error.message);
        }
    }

    // Populate preset selection box
    populatePresetSelect() {
        if (!this.presetSelect) {
            console.error('Preset select box element not found');
            return;
        }
        
        this.presetSelect.innerHTML = '<option value="">Select Preset...</option>';
        
        if (this.presets && this.presets.presets) {
            console.log(`Adding ${this.presets.presets.length} presets to dropdown...`);
            this.presets.presets.forEach((preset, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = preset.name;
                this.presetSelect.appendChild(option);
                console.log(`Added preset: ${preset.name}`);
            });
        } else {
            console.error('No preset data found:', this.presets);
        }
    }

    // Load selected preset
    loadSelectedPreset() {
        const selectedIndex = this.presetSelect.value;
        if (selectedIndex === '' || !this.presets) {
            this.showNotification('Please select a preset to load.');
            return;
        }

        const preset = this.presets.presets[selectedIndex];
        if (!preset) return;

        // Load equations
        this.clearEquations(); // Clear existing before loading new ones
        if (preset.equations && preset.equations.length > 0) {
            preset.equations.forEach(eq => {
                this.addEquationInput(eq.formula, eq.color);
            });
        } else {
            // If preset has no equations, add one empty input
            this.addEquationInput();
        }

        // Set start position
        if (preset.startPosition) {
            this.startXInput.value = preset.startPosition[0];
            this.startYInput.value = preset.startPosition[1];
            this.startZInput.value = preset.startPosition[2];
        }

        // Load environment settings
        if (preset.environment) {
            this.loadEnvironmentSettings(preset.environment);
        }

        this.showSuccess(`Preset "${preset.name}" loaded.`);
    }

    // Add equation input field
    addEquationInput(formula = '', color = '#cccccc') {
        const equationDiv = document.createElement('div');
        equationDiv.className = 'equation-input';
        
        equationDiv.innerHTML = `
            <input type="text" class="equation" placeholder="e.g: sin(x) + cos(y)" value="${formula}">
            <input type="color" class="equation-color" value="${color}">
            <button class="remove-equation">Remove</button>
        `;

        // Remove button event
        const removeBtn = equationDiv.querySelector('.remove-equation');
        removeBtn.addEventListener('click', () => {
            equationDiv.remove();
        });

        this.equationsContainer.appendChild(equationDiv);
    }

    // Clear all equations
    clearEquations() {
        this.equationsContainer.innerHTML = '';
    }

    // Collect current equations
    collectEquations() {
        const equations = [];
        const equationInputs = this.equationsContainer.querySelectorAll('.equation-input');
        
        equationInputs.forEach(input => {
            const formula = input.querySelector('.equation').value.trim();
            const color = input.querySelector('.equation-color').value;
            
            if (formula) {
                equations.push({ formula, color });
            }
        });

        return equations;
    }

    // Start the game
    startGame() {
        const equations = this.collectEquations();
        
        if (equations.length === 0) {
            this.showError('Please enter at least one equation.');
            return;
        }

        // Validate and compile equations
        const compiledEquations = window.mathParser.compileMultipleExpressions(equations);
        
        if (compiledEquations.length === 0) {
            this.showError('No valid equations. Please check your formulas.');
            return;
        }

        // Set start position
        const startX = parseFloat(this.startXInput.value) || 0;
        const startY = parseFloat(this.startYInput.value) || 0;
        const startZ = parseFloat(this.startZInput.value) || 5;

        // Collect environment settings
        const environmentSettings = this.collectEnvironmentSettings();

        // Initialize game
        this.initializeGame(compiledEquations, startX, startY, startZ, environmentSettings);
        
        // Switch UI
        this.hideMenu();
        this.showGame();
    }

    // Initialize the game
    initializeGame(equations, startX, startY, startZ, environmentSettings) {
        // Set terrain equations
        window.terrainGenerator.setEquations(equations);
        
        // Apply environment settings (항상 적용)
        if (window.renderer) {
            // 환경 설정이 없으면 현재 UI 값을 사용
            const settings = environmentSettings || this.collectEnvironmentSettings();
            window.renderer.setEnvironment(settings);
            console.log('Environment settings applied:', settings);
        }
        
        // Calculate terrain height and place player on top
        const terrainHeight = window.terrainGenerator.getHeightAt(startX * window.terrainGenerator.scale, startY * window.terrainGenerator.scale);
        const actualStartZ = Math.max(startZ, terrainHeight + 5); // Start 5 units above terrain
        
        // Set camera position
        window.camera.setPosition(startX, startY, actualStartZ);
        
        // Reset physics engine
        window.physicsEngine.reset();
        window.physicsEngine.setPlayerPosition(startX, startY, actualStartZ - 1.7);
        
        this.currentEquations = equations;
        
        // Generate initial chunks
        window.terrainGenerator.updateChunks(startX, startY, actualStartZ);
        
        console.log(`Game started: Position (${startX}, ${startY}, ${actualStartZ}), Terrain Height: ${terrainHeight}`);
    }

    // Show menu
    showMenu() {
        this.gameContainer.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
        
        // Release pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        
        // Show mouse cursor again
        document.body.style.cursor = 'default';
    }

    // Hide menu
    hideMenu() {
        this.mainMenu.classList.add('hidden');
    }

    // Show game screen
    showGame() {
        this.gameContainer.classList.remove('hidden');
        
        // Game start instruction message
        this.showNotification('Click on the canvas to lock the mouse and start the game!', 'info');
    }

    // Hide loading screen
    hideLoading() {
        this.loadingScreen.classList.add('hidden');
        this.mainMenu.classList.remove('hidden');
    }

    // Update coordinates (removed)
    updateCoordinates(x, y, z) {
        // UI coordinate display function removed
    }

    // Show success message
    showSuccess(message) {
        // this.showNotification(message, 'success');
    }

    // Show error message
    showError(message) {
        // this.showNotification(message, 'error');
        console.error(message); // Keep error in console
    }

    // Show notification message
    showNotification(message, type = 'info') {
        // Notification feature disabled
    }

    // Handle initialization completion
    onInitializationComplete() {
        console.log("UI initialization complete, all elements are ready.");
        this.hideLoading();
    }

    // Return current equations
    getCurrentEquations() {
        return this.currentEquations;
    }

    // Show debug info (for development)
    showDebugInfo(info) {
        // Only use during development
        if (window.DEBUG) {
            console.log('Debug Info:', info);
        }
    }

    // Collect environment settings
    collectEnvironmentSettings() {
        return {
            skyColorTop: this.environmentInputs.skyColorTop.value,
            skyColorHorizon: this.environmentInputs.skyColorHorizon.value,
            sunColor: this.environmentInputs.sunColor.value,
            sunIntensity: parseFloat(this.environmentInputs.sunIntensity.value),
            ambientColor: this.environmentInputs.ambientColor.value,
            ambientIntensity: parseFloat(this.environmentInputs.ambientIntensity.value),
            fogColor: this.environmentInputs.fogColor.value,
            fogDensity: parseFloat(this.environmentInputs.fogDensity.value),
            fogStart: parseFloat(this.environmentInputs.fogStart.value),
            gamma: parseFloat(this.environmentInputs.gamma.value),
            timeSpeed: parseFloat(this.environmentInputs.timeSpeed.value),
            timePause: this.environmentInputs.timePause.checked
        };
    }

    // Load environment settings
    loadEnvironmentSettings(environment) {
        if (environment.skyColorTop) this.environmentInputs.skyColorTop.value = environment.skyColorTop;
        if (environment.skyColorHorizon) this.environmentInputs.skyColorHorizon.value = environment.skyColorHorizon;
        if (environment.sunColor) this.environmentInputs.sunColor.value = environment.sunColor;
        if (environment.sunIntensity !== undefined) {
            this.environmentInputs.sunIntensity.value = environment.sunIntensity;
        }
        if (environment.ambientColor) this.environmentInputs.ambientColor.value = environment.ambientColor;
        if (environment.ambientIntensity !== undefined) {
            this.environmentInputs.ambientIntensity.value = environment.ambientIntensity;
        }
        if (environment.fogColor) this.environmentInputs.fogColor.value = environment.fogColor;
        if (environment.fogDensity !== undefined) {
            this.environmentInputs.fogDensity.value = environment.fogDensity;
        }
        if (environment.fogStart !== undefined) {
            this.environmentInputs.fogStart.value = environment.fogStart;
        }
        if (environment.gamma !== undefined) {
            this.environmentInputs.gamma.value = environment.gamma;
        }
        if (environment.timeSpeed !== undefined) {
            this.environmentInputs.timeSpeed.value = environment.timeSpeed;
        }
        if (environment.timePause !== undefined) {
            this.environmentInputs.timePause.checked = environment.timePause;
        }
    }

    // Update environment settings in real-time
    updateEnvironmentSettings() {
        if (window.renderer) {
            const settings = this.collectEnvironmentSettings();
            window.renderer.setEnvironment(settings);
            console.log('Environment settings updated:', settings);
        }
    }
}

// Create global instance
window.uiManager = new UIManager(); 