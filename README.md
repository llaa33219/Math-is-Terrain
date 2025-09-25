# Math is Terrain

3D mathematical terrain visualization system that renders mathematical equations as interactive terrain.

## Features

- **Real-time 3D Terrain Rendering**: Visualize mathematical equations as 3D terrain
- **Dynamic Equation Input**: Support for complex mathematical expressions
- **Chunk-based Rendering**: Efficient terrain generation using spatial partitioning
- **Performance Optimizations**: Advanced chunk update system for smooth camera movement
- **Unified Resolution**: All chunks use consistent resolution for optimal performance
- **Distance-based Culling**: Only nearby chunks are processed and rendered
- **Physics Integration**: Realistic player movement and collision detection
- **Multiple Equation Support**: Combine multiple mathematical functions
- **Environmental Controls**: Customizable lighting, fog, and atmospheric effects

## Performance Optimizations

### Chunk Update System

The terrain system has been optimized to prevent lag during camera movement:

- **Decoupled Updates**: Camera movement is now separate from terrain chunk updates
- **Threshold-based Updates**: Chunks only update when camera moves significantly
- **Frame-distributed Processing**: Chunk updates are spread across multiple frames
- **Unified Resolution**: All chunks use the same resolution for consistent performance
- **Distance Culling**: Aggressive removal of distant chunks to maintain performance
- **Limited Range**: Only processes chunks within a small radius around the player

### Performance Settings

You can adjust performance parameters dynamically:

```javascript
// Example: Adjust performance settings for better/worse hardware
window.terrainGenerator.adjustPerformanceSettings({
    chunkUpdateThreshold: 10, // Distance camera must move to trigger update
    chunksPerFrame: 2,        // Number of chunks to process per frame
    viewDistance: 3,          // Active chunk rendering distance (reduced)
    generateDistance: 5       // Chunk generation distance (reduced)
});
```

### Performance Monitoring

Get real-time performance statistics:

```javascript
const stats = window.terrainGenerator.getPerformanceStats();
console.log(stats);
// Output: { activeChunks: 25, totalChunks: 156, pendingUpdates: 3, ... }
```

## Usage

1. **Load the Application**: Open `index.html` in a modern web browser
2. **Enter Mathematical Equations**: Use the sidebar to input equations like `sin(x) + cos(y)`
3. **Adjust Environment**: Modify lighting, fog, and other visual settings
4. **Navigate**: Use WASD keys to move, mouse to look around
5. **Optimize Performance**: Adjust settings based on your hardware capabilities

## Mathematical Functions

Supported functions include:
- Basic operations: `+`, `-`, `*`, `/`, `^`
- Trigonometric: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`
- Logarithmic: `log`, `log10`, `exp`
- Special: `sqrt`, `abs`, `floor`, `ceil`, `round`
- Custom: `mod`, `fract`, `clamp`, `lerp`, `smoothstep`

## Performance Tips

1. **For Low-End Hardware**:
   - Increase `chunkUpdateThreshold` to 15-20
   - Reduce `chunksPerFrame` to 1-2
   - Lower `viewDistance` to 2-3
   - Reduce `generateDistance` to 3-4

2. **For High-End Hardware**:
   - Decrease `chunkUpdateThreshold` to 5-6
   - Increase `chunksPerFrame` to 4-6
   - Raise `viewDistance` to 5-6
   - Increase `generateDistance` to 7-8

3. **Optimized Performance**:
   - Limited range means fewer chunks to manage
   - Aggressive distance culling keeps memory usage low
   - Automatic cleanup every 2 seconds removes distant chunks
   - Maximum 50 cached chunks (down from 500)
   - Unified resolution eliminates chunk regeneration overhead

## Technical Details

- **Rendering Engine**: WebGL 2.0 with fallback to WebGL 1.0
- **Chunk System**: Limited-range spatial partitioning with unified resolution
- **Update Strategy**: Asynchronous chunk generation with frame-distributed application
- **Memory Management**: Aggressive cleanup with distance-based culling
- **Range Limits**: View distance 4 chunks, generation distance 6 chunks
- **Collision Detection**: Bilinear interpolation for smooth terrain interaction
- **Performance**: Simplified architecture optimized for nearby terrain only

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## License

This project is open source and available under the MIT License.

## 🌟 주요 기능

- **수학 수식 기반 지형 생성**: 다양한 수학 함수를 입력하여 실시간으로 지형 생성
- **1인칭 3D 탐험**: WASD 키와 마우스로 자유로운 1인칭 시점 탐험
- **물리 엔진**: 중력, 충돌 감지, 점프 등의 물리 시뮬레이션
- **무한 맵**: 플레이어 주변을 중심으로 무한히 확장되는 지형
- **프리셋 시스템**: 미리 정의된 아름다운 지형들을 쉽게 로드
- **다중 수식 지원**: 여러 수식을 조합하여 복합적인 지형 생성
- **색상 커스터마이징**: 각 수식별로 고유한 색상 설정 가능
- **최적화**: 청크 기반 렌더링으로 성능 최적화

## 🚀 시작하기

### 필수 조건

- 모던 웹 브라우저 (Chrome, Firefox, Safari, Edge)
- WebGL 지원

### 실행 방법

1. 모든 파일을 웹 서버에 업로드하거나 로컬 서버를 실행
2. `index.html` 파일을 브라우저에서 열기
3. 프리셋을 선택하거나 직접 수식을 입력
4. "게임 시작" 버튼 클릭

### 로컬 서버 실행 (권장)

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (http-server 패키지 필요)
npx http-server

# PHP
php -S localhost:8000
```

## 🎮 조작 방법

### 이동
- **W, A, S, D**: 전후좌우 이동
- **마우스**: 시점 회전
- **Space**: 점프
- **Shift**: 빠른 이동
- **ESC**: 메뉴 열기

### 인터페이스
- **프리셋 선택**: 미리 정의된 지형 로드
- **수식 입력**: 사용자 정의 수학 함수 입력
- **색상 설정**: 각 수식의 시각적 색상 설정
- **시작 좌표**: 탐험을 시작할 위치 설정

## 📐 지원하는 수학 함수

### 기본 함수
- `sin(x)`, `cos(x)`, `tan(x)`: 삼각 함수
- `asin(x)`, `acos(x)`, `atan(x)`: 역삼각 함수
- `atan2(y,x)`: 2변수 arctangent
- `sinh(x)`, `cosh(x)`, `tanh(x)`: 쌍곡 함수

### 지수 및 로그
- `exp(x)`: 자연 지수 함수
- `log(x)`: 자연 로그
- `log10(x)`: 상용 로그
- `log2(x)`: 이진 로그
- `pow(x,y)`: 거듭제곱 (x^y)
- `sqrt(x)`: 제곱근

### 기타 함수
- `abs(x)`: 절댓값
- `floor(x)`, `ceil(x)`, `round(x)`: 반올림 함수
- `min(x,y)`, `max(x,y)`: 최솟값, 최댓값
- `random()`: 0~1 사이의 난수

### 상수
- `PI` 또는 `pi`: 원주율 (3.14159...)
- `E` 또는 `e`: 자연상수 (2.71828...)

### 변수
- `x`, `y`: 2D 좌표 (지형의 가로, 세로)
- `z`: 3D 좌표 (높이, 함수 결과값)

## 🎨 수식 예시

### 기본 지형
```javascript
sin(x) + cos(y)                    // 기본 파도
sin(x*0.1)*cos(y*0.1)*10          // 큰 산맥
sin(sqrt(x*x + y*y))              // 원형 파장
```

### 복합 지형
```javascript
sin(x)*cos(y) + sin(x*2)*cos(y*2)*0.5    // 프랙탈 패턴
sin(atan2(y,x)*3)*3                      // 나선형
(sin(x)*sin(y) > 0) ? 3 : -3             // 체스판 패턴
```

### 고급 지형
```javascript
sin(x*0.2)*sin(y*0.2)*20 + cos(x*0.1)*cos(y*0.1)*10  // 복잡한 계곡
-sqrt(x*x + y*y)*0.1 + 5                              // 화산 형태
sin(sqrt(x*x + y*y))*5/(sqrt(x*x + y*y) + 1)         // 리플 효과
```

## 🔧 기술 스택

- **Frontend**: 바닐라 JavaScript (ES6+)
- **렌더링**: WebGL 1.0/2.0
- **수학 처리**: 커스텀 수식 파서
- **물리 엔진**: 커스텀 3D 물리 시뮬레이션
- **UI**: HTML5 + CSS3

## 📁 프로젝트 구조

```
Math is Terrain/
├── index.html              # 메인 HTML 파일
├── css/
│   └── style.css           # 스타일시트
├── js/
│   ├── main.js             # 메인 애플리케이션
│   ├── renderer.js         # 3D 렌더링 엔진
│   ├── terrain.js          # 지형 생성기
│   ├── physics.js          # 물리 엔진
│   ├── camera.js           # 카메라 컨트롤
│   ├── math-parser.js      # 수식 파서
│   └── ui.js               # UI 관리자
├── data/
│   └── presets.json        # 프리셋 데이터
└── README.md               # 프로젝트 설명서
```

## 🎯 프리셋 지형

1. **기본 파도**: 간단한 사인파 지형
2. **산맥**: 복잡한 산맥 지형
3. **화산 지대**: 화산과 같은 원뿔 형태
4. **리플 효과**: 물에 돌을 던진 듯한 파장
5. **체스판 지형**: 체스판 패턴의 지형
6. **무한 계곡**: 깊은 계곡과 높은 산
7. **소용돌이**: 나선형 소용돌이 지형
8. **프랙탈 산**: 프랙탈 패턴의 복잡한 산지

## 🔍 성능 최적화

- **청크 기반 렌더링**: 플레이어 주변만 렌더링하여 성능 향상
- **LOD (Level of Detail)**: 거리에 따른 해상도 조절
- **메모리 관리**: 사용하지 않는 청크 자동 정리
- **효율적인 수식 컴파일**: 한 번 컴파일된 수식 재사용

## 🚨 주의사항

- 복잡한 수식은 성능에 영향을 줄 수 있습니다
- 웹GL을 지원하지 않는 브라우저에서는 실행되지 않습니다
- 로컬 파일로 실행 시 CORS 오류가 발생할 수 있으므로 웹 서버 사용을 권장합니다

## 🐛 문제 해결

### 게임이 로드되지 않는 경우
- 브라우저가 WebGL을 지원하는지 확인
- 콘솔에서 오류 메시지 확인
- 웹 서버를 통해 실행 (file:// 프로토콜 사용 금지)

### 성능이 느린 경우
- 복잡한 수식 사용 자제
- 브라우저의 하드웨어 가속 활성화 확인
- 다른 탭들 닫기

### 수식 오류가 발생하는 경우
- 지원하는 함수와 변수만 사용
- 괄호 짝 맞추기
- 변수명 확인 (x, y만 사용 가능)

## 🎓 교육적 활용

이 프로젝트는 다음과 같은 교육 목적으로 활용할 수 있습니다:

- **수학 시각화**: 추상적인 수학 함수를 3D로 시각화
- **함수 이해**: 다양한 함수들의 형태와 특성 학습
- **창의적 탐구**: 새로운 수식 조합을 통한 창의적 사고
- **프로그래밍 학습**: 바닐라 JavaScript와 WebGL 학습

---

**Math is Terrain**으로 수학의 아름다움을 3D 세계에서 직접 체험해보세요! 🚀✨ 