class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = this.initWebGL();
        this.program = null;
        this.buffers = {};
        this.uniforms = {};
        this.attributes = {};
        
        this.viewMatrix = mat4.create();
        this.projectionMatrix = mat4.create();
        this.modelMatrix = mat4.create();
        
        // 환경 설정 기본값
        this.environment = {
            skyColorTop: [0.29, 0.56, 0.88],
            skyColorHorizon: [0.53, 0.81, 0.92],
            sunColor: [1.0, 0.97, 0.86],
            sunIntensity: 1.0,
            ambientColor: [0.25, 0.25, 0.5],
            ambientIntensity: 0.3,
            fogColor: [0.69, 0.77, 0.87],
            fogDensity: 0.003,
            fogStart: 10,
            gamma: 2.2,
            timeSpeed: 1.0,
            timePause: false
        };
        
        // 시간 변수
        this.currentTime = 0;
        
        this.initShaders();
        this.initBuffers();
        this.resize();
        
        // 렌더링 설정
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        
        window.addEventListener('resize', () => this.resize());
    }

    initWebGL() {
        const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
        if (!gl) {
            throw new Error('WebGL을 지원하지 않는 브라우저입니다.');
        }
        
        // 32비트 인덱스 지원을 위한 확장 활성화
        const ext = gl.getExtension('OES_element_index_uint');
        if (!ext) {
            console.warn('OES_element_index_uint 확장을 지원하지 않습니다. 대규모 지형에서 문제가 발생할 수 있습니다.');
        }
        
        return gl;
    }

    initShaders() {
        const vertexShaderSource = `
            attribute vec3 a_position;
            attribute vec3 a_color;
            attribute vec3 a_normal;
            
            uniform mat4 u_modelMatrix;
            uniform mat4 u_viewMatrix;
            uniform mat4 u_projectionMatrix;
            uniform vec3 u_sunDirection;
            uniform vec3 u_cameraPosition;
            uniform float u_time;
            
            varying vec3 v_color;
            varying vec3 v_worldPos;
            varying vec3 v_normal;
            varying vec3 v_cameraPos;
            
            void main() {
                vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
                gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
                
                // 법선을 월드 공간으로 변환 (모델 행렬의 회전만 적용)
                // 간단히 하기 위해 스케일이 균일하다고 가정
                v_normal = mat3(u_modelMatrix) * a_normal;
                
                v_color = a_color;
                v_worldPos = worldPosition.xyz;
                v_cameraPos = u_cameraPosition;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec3 v_color;
            varying vec3 v_worldPos;
            varying vec3 v_normal;
            varying vec3 v_cameraPos;
            
            uniform vec3 u_sunDirection;
            uniform vec3 u_sunColor;
            uniform float u_sunIntensity;
            uniform vec3 u_ambientColor;
            uniform float u_ambientIntensity;
            uniform vec3 u_fogColor;
            uniform float u_fogDensity;
            uniform float u_fogStart;
            uniform vec3 u_skyColorTop;
            uniform vec3 u_skyColorHorizon;
            uniform float u_gamma;
            
            void main() {
                // 현실적인 조명 계산
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(-u_sunDirection);
                
                // 주변광 (자연스러운 환경광) - 흰색 기준으로 계산
                vec3 ambient = vec3(u_ambientIntensity);
                
                // 확산광 (램버트 반사) - 흰색 기준으로 계산
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = vec3(u_sunIntensity * diff);
                
                // 조명 강도 계산 (색상 정보 없이)
                float lightingIntensity = ambient.r + diffuse.r;
                lightingIntensity = clamp(lightingIntensity, 0.0, 1.0);
                
                // 지형 색상 유지하면서 밝기만 조절
                vec3 finalColor = v_color * lightingIntensity;
                
                // 그림자 영역에서도 최소한의 가시성 보장
                finalColor = max(finalColor, v_color * 0.1);
                
                // 거리 안개
                float distance = length(v_worldPos - v_cameraPos);
                float fogAmount = 1.0 - exp(-pow(max(distance - u_fogStart, 0.0) * u_fogDensity, 2.0));
                fogAmount = clamp(fogAmount, 0.0, 1.0);
                
                // 하늘 색상
                vec3 skyColor = mix(u_skyColorHorizon, u_skyColorTop, 0.5);
                
                // 안개 적용
                finalColor = mix(finalColor, skyColor, fogAmount);
                
                // 감마 보정
                finalColor = pow(finalColor, vec3(1.0 / u_gamma));
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        this.program = this.createProgram(vertexShader, fragmentShader);
        this.gl.useProgram(this.program);
        
        // 속성 및 유니폼 위치 저장
        this.attributes.position = this.gl.getAttribLocation(this.program, 'a_position');
        this.attributes.color = this.gl.getAttribLocation(this.program, 'a_color');
        this.attributes.normal = this.gl.getAttribLocation(this.program, 'a_normal');
        
        this.uniforms.modelMatrix = this.gl.getUniformLocation(this.program, 'u_modelMatrix');
        this.uniforms.viewMatrix = this.gl.getUniformLocation(this.program, 'u_viewMatrix');
        this.uniforms.projectionMatrix = this.gl.getUniformLocation(this.program, 'u_projectionMatrix');
        this.uniforms.sunDirection = this.gl.getUniformLocation(this.program, 'u_sunDirection');
        this.uniforms.sunColor = this.gl.getUniformLocation(this.program, 'u_sunColor');
        this.uniforms.sunIntensity = this.gl.getUniformLocation(this.program, 'u_sunIntensity');
        this.uniforms.ambientColor = this.gl.getUniformLocation(this.program, 'u_ambientColor');
        this.uniforms.ambientIntensity = this.gl.getUniformLocation(this.program, 'u_ambientIntensity');
        this.uniforms.fogColor = this.gl.getUniformLocation(this.program, 'u_fogColor');
        this.uniforms.fogDensity = this.gl.getUniformLocation(this.program, 'u_fogDensity');
        this.uniforms.fogStart = this.gl.getUniformLocation(this.program, 'u_fogStart');
        this.uniforms.skyColorTop = this.gl.getUniformLocation(this.program, 'u_skyColorTop');
        this.uniforms.skyColorHorizon = this.gl.getUniformLocation(this.program, 'u_skyColorHorizon');
        this.uniforms.gamma = this.gl.getUniformLocation(this.program, 'u_gamma');
        this.uniforms.time = this.gl.getUniformLocation(this.program, 'u_time');
        this.uniforms.cameraPosition = this.gl.getUniformLocation(this.program, 'u_cameraPosition');
        
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.enableVertexAttribArray(this.attributes.normal);
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('셰이더 컴파일 오류: ' + error);
        }
        
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteProgram(program);
            throw new Error('프로그램 링크 오류: ' + error);
        }
        
        return program;
    }

    initBuffers() {
        this.buffers.position = this.gl.createBuffer();
        this.buffers.color = this.gl.createBuffer();
        this.buffers.normal = this.gl.createBuffer();
        this.buffers.indices = this.gl.createBuffer();
    }

    updateTerrainBuffers(vertices, colors, normals, indices) {
        // 위치 버퍼 업데이트
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.DYNAMIC_DRAW);
        
        // 색상 버퍼 업데이트
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
        
        // 법선 버퍼 업데이트
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(normals), this.gl.DYNAMIC_DRAW);
        
        // 인덱스 버퍼 업데이트 - Uint32Array로 변경
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), this.gl.DYNAMIC_DRAW);
        
        this.indexCount = indices.length;
    }

    // 환경 설정 업데이트
    setEnvironment(envSettings) {
        Object.assign(this.environment, envSettings);
        
        // 색상 문자열을 RGB 배열로 변환
        if (envSettings.skyColorTop && typeof envSettings.skyColorTop === 'string') {
            this.environment.skyColorTop = this.hexToRgb(envSettings.skyColorTop);
        }
        if (envSettings.skyColorHorizon && typeof envSettings.skyColorHorizon === 'string') {
            this.environment.skyColorHorizon = this.hexToRgb(envSettings.skyColorHorizon);
        }
        if (envSettings.sunColor && typeof envSettings.sunColor === 'string') {
            this.environment.sunColor = this.hexToRgb(envSettings.sunColor);
        }
        if (envSettings.ambientColor && typeof envSettings.ambientColor === 'string') {
            this.environment.ambientColor = this.hexToRgb(envSettings.ambientColor);
        }
        if (envSettings.fogColor && typeof envSettings.fogColor === 'string') {
            this.environment.fogColor = this.hexToRgb(envSettings.fogColor);
        }
    }

    // 16진수 색상을 RGB 배열로 변환
    hexToRgb(hex) {
        const r = parseInt(hex.substr(1, 2), 16) / 255;
        const g = parseInt(hex.substr(3, 2), 16) / 255;
        const b = parseInt(hex.substr(5, 2), 16) / 255;
        return [r, g, b];
    }

    // RGB 배열을 16진수 색상으로 변환
    rgbToHex(rgb) {
        const r = Math.round(rgb[0] * 255).toString(16).padStart(2, '0');
        const g = Math.round(rgb[1] * 255).toString(16).padStart(2, '0');
        const b = Math.round(rgb[2] * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    render(camera) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // 시간 업데이트
        if (!this.environment.timePause) {
            this.currentTime += 0.003 * this.environment.timeSpeed;
        }
        
        // 하늘 렌더링
        this.renderSky(camera);
        
        // 지형 데이터가 없으면 렌더링 중단
        if (!this.indexCount || this.indexCount <= 0) {
            return;
        }
        
        this.gl.useProgram(this.program);
        
        // 행렬 설정 - 카메라 오프셋 적용
        camera.getViewMatrix(this.viewMatrix);
        
        // 모델 행렬에 카메라 오프셋 적용
        const terrainData = window.terrainGenerator.getTerrainData();
        const offset = terrainData.cameraOffset || [0, 0, 0];
        mat4.identity(this.modelMatrix);
        this.modelMatrix[12] = offset[0];
        this.modelMatrix[13] = offset[1];
        this.modelMatrix[14] = offset[2];
        
        this.gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, this.modelMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.viewMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.projectionMatrix);
        
        this.setEnvironmentUniforms();
        this.gl.uniform3fv(this.uniforms.cameraPosition, camera.getPosition());

        // 버퍼 바인딩 및 속성 설정
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.position);
        this.gl.vertexAttribPointer(this.attributes.position, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.vertexAttribPointer(this.attributes.color, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.normal);
        this.gl.vertexAttribPointer(this.attributes.normal, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.buffers.indices);

        // 폴리곤 오프셋으로 그래픽 깨짐 완화
        this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
        this.gl.polygonOffset(1.0, 1.0);

        // 지형 그리기
        this.gl.drawElements(this.gl.TRIANGLES, this.indexCount, this.gl.UNSIGNED_INT, 0);

        // 폴리곤 오프셋 비활성화
        this.gl.disable(this.gl.POLYGON_OFFSET_FILL);
    }

    // 하늘 렌더링
    renderSky(camera) {
        // 현재 환경 설정에 따른 하늘 색상
        const skyColorTop = this.environment.skyColorTop;
        const skyColorHorizon = this.environment.skyColorHorizon;
        
        // 시점에 따른 색상 보간
        const cameraRotation = camera.getRotation();
        const pitch = cameraRotation[0];
        const lookUpFactor = Math.max(0, Math.min(1, pitch / (Math.PI / 2)));
        
        let r = skyColorHorizon[0] * (1 - lookUpFactor) + skyColorTop[0] * lookUpFactor;
        let g = skyColorHorizon[1] * (1 - lookUpFactor) + skyColorTop[1] * lookUpFactor;
        let b = skyColorHorizon[2] * (1 - lookUpFactor) + skyColorTop[2] * lookUpFactor;
        
        // 태양 위치 계산
        const sunAngle = this.currentTime;
        const sunDirection = [
            Math.sin(sunAngle) * 0.8,
            Math.cos(sunAngle) * 0.3,
            -0.2 - Math.cos(sunAngle) * 0.6
        ];
        
        // 카메라 방향 벡터 계산
        const yaw = cameraRotation[1];
        const cameraForward = [
            Math.sin(yaw) * Math.cos(pitch),
            Math.cos(yaw) * Math.cos(pitch),
            Math.sin(pitch)
        ];
        
        // 태양과 카메라 방향의 각도 계산
        const dotProduct = cameraForward[0] * (-sunDirection[0]) + 
                          cameraForward[1] * (-sunDirection[1]) + 
                          cameraForward[2] * (-sunDirection[2]);
        
        // 태양이 보이는 방향일 때 하늘 색상에 태양 효과 추가
        if (dotProduct > 0.7) { // 태양 근처를 볼 때 (범위 확대)
            const sunIntensity = Math.pow(Math.max(0, dotProduct - 0.7) / 0.3, 2);
            const sunColor = this.environment.sunColor;
            
            // 태양 디스크 효과 (중심에서 강한 빛)
            if (dotProduct > 0.95) {
                // 태양 중심부 - 매우 밝은 원
                r = Math.min(1, r + sunColor[0] * 0.8);
                g = Math.min(1, g + sunColor[1] * 0.8);
                b = Math.min(1, b + sunColor[2] * 0.8);
            } else if (dotProduct > 0.9) {
                // 태양 가장자리 - 밝은 원
                r = Math.min(1, r + sunColor[0] * sunIntensity * 0.6);
                g = Math.min(1, g + sunColor[1] * sunIntensity * 0.6);
                b = Math.min(1, b + sunColor[2] * sunIntensity * 0.6);
            } else {
                // 태양 주변 광환
                r = Math.min(1, r + sunColor[0] * sunIntensity * 0.3);
                g = Math.min(1, g + sunColor[1] * sunIntensity * 0.3);
                b = Math.min(1, b + sunColor[2] * sunIntensity * 0.3);
            }
        }
        
        this.gl.clearColor(r, g, b, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        const aspect = this.canvas.width / this.canvas.height;
        mat4.perspective(this.projectionMatrix, Math.PI / 4, aspect, 1.0, 2000.0);
        
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    // 환경 설정 가져오기
    getEnvironment() {
        return {...this.environment};
    }
    
    setEnvironmentUniforms() {
        // 현실적인 태양 위치 계산 (시간에 따른 움직임)
        const sunAngle = this.currentTime;
        const sunDirection = [
            Math.sin(sunAngle) * 0.8,     // 동서 방향
            Math.cos(sunAngle) * 0.3,     // 남북 방향 (약간만)
            -0.2 - Math.cos(sunAngle) * 0.6  // 높이 (일출/일몰)
        ];
        
        // 유니폼 설정
        this.gl.uniform3fv(this.uniforms.sunDirection, sunDirection);
        this.gl.uniform3fv(this.uniforms.sunColor, this.environment.sunColor);
        this.gl.uniform1f(this.uniforms.sunIntensity, this.environment.sunIntensity);
        this.gl.uniform3fv(this.uniforms.ambientColor, this.environment.ambientColor);
        this.gl.uniform1f(this.uniforms.ambientIntensity, this.environment.ambientIntensity);
        this.gl.uniform3fv(this.uniforms.fogColor, this.environment.fogColor);
        this.gl.uniform1f(this.uniforms.fogDensity, this.environment.fogDensity);
        this.gl.uniform1f(this.uniforms.fogStart, this.environment.fogStart);
        this.gl.uniform3fv(this.uniforms.skyColorTop, this.environment.skyColorTop);
        this.gl.uniform3fv(this.uniforms.skyColorHorizon, this.environment.skyColorHorizon);
        this.gl.uniform1f(this.uniforms.gamma, this.environment.gamma);
        this.gl.uniform1f(this.uniforms.time, this.currentTime);
    }
}

// 간단한 행렬 라이브러리 (mat4)
const mat4 = {
    create() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },

    perspective(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) * nf;
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = 2 * far * near * nf;
        out[15] = 0;
        
        return out;
    },

    lookAt(out, eye, center, up) {
        const eyex = eye[0], eyey = eye[1], eyez = eye[2];
        const upx = up[0], upy = up[1], upz = up[2];
        const centerx = center[0], centery = center[1], centerz = center[2];

        if (Math.abs(eyex - centerx) < 0.000001 &&
            Math.abs(eyey - centery) < 0.000001 &&
            Math.abs(eyez - centerz) < 0.000001) {
            return mat4.identity(out);
        }

        let z0 = eyex - centerx;
        let z1 = eyey - centery;
        let z2 = eyez - centerz;

        let len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        z0 *= len;
        z1 *= len;
        z2 *= len;

        let x0 = upy * z2 - upz * z1;
        let x1 = upz * z0 - upx * z2;
        let x2 = upx * z1 - upy * z0;
        len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        if (!len) {
            x0 = 0;
            x1 = 0;
            x2 = 0;
        } else {
            len = 1 / len;
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }

        let y0 = z1 * x2 - z2 * x1;
        let y1 = z2 * x0 - z0 * x2;
        let y2 = z0 * x1 - z1 * x0;

        out[0] = x0;
        out[1] = y0;
        out[2] = z0;
        out[3] = 0;
        out[4] = x1;
        out[5] = y1;
        out[6] = z1;
        out[7] = 0;
        out[8] = x2;
        out[9] = y2;
        out[10] = z2;
        out[11] = 0;
        out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
        out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
        out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
        out[15] = 1;

        return out;
    },

    identity(out) {
        out[0] = 1;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = 1;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = 1;
        out[11] = 0;
        out[12] = 0;
        out[13] = 0;
        out[14] = 0;
        out[15] = 1;
        return out;
    }
}; 