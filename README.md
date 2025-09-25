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
