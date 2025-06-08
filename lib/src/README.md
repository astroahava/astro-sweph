# Swiss Ephemeris WebAssembly Interface

A high-performance WebAssembly port of the Swiss Ephemeris astronomical calculation library, optimized for web applications and standalone deployment.

## Overview

This library provides comprehensive astrological calculations including planetary positions, house systems, nodes, apsides, and asteroid positions. The interface is designed for easy integration with JavaScript applications while maintaining the precision and reliability of the Swiss Ephemeris.

## Features

- **Complete Astrological Charts**: Planetary positions, house cusps, and major angles
- **High Precision**: Arc-second accuracy for major planets (1800-2400 CE)
- **Multiple House Systems**: Placidus, Koch, Whole Sign, Equal, and many others
- **Nodes and Apsides**: Calculation methods for all planetary nodes and orbital extremes
- **Asteroid Support**: Position calculations for numbered asteroids
- **Single-File Deployment**: All ephemeris data embedded in one JavaScript file
- **Memory Management**: Proper allocation/deallocation for long-running applications
- **JSON Output**: Structured data format for easy parsing

## Quick Start

### Building

```bash
# Build the single-file production version (recommended)
make embedded

# Install to js directory
make install

# For development with debug symbols
make development
make install-dev
```

### JavaScript Usage

```javascript
// Load the module
const Module = await import('./astro-embedded.js');

// Calculate a birth chart
const chart = Module.ccall('get', 'string',
  ['number', 'number', 'number', 'number', 'number', 'number',
   'number', 'number', 'number', 'string', 'number', 'number', 'number', 'string', 'string'],
  [2023, 12, 25, 12, 0, 0, 0, 5, 30, "W", 51, 30, 0, "N", "P"]);

const data = JSON.parse(chart);
console.log(data.planets[0].name); // "Sun"
console.log(data.houses[0].long); // 1st house cusp longitude

// Important: Free memory when done
Module.ccall('freeMemory', null, ['number'], [chart]);
```

## API Reference

### Core Functions

#### `get(year, month, day, hour, minute, second, lonG, lonM, lonS, lonEW, latG, latM, latS, latNS, iHouse)`

Complete astrological chart calculation including planets, houses, and angles.

**Parameters:**
- `year`: Year (1800-2400 for best accuracy)
- `month`: Month (1-12)
- `day`: Day (1-31)
- `hour`: Hour (0-23)
- `minute`: Minute (0-59)
- `second`: Second (0-59)
- `lonG/lonM/lonS`: Longitude degrees/minutes/seconds
- `lonEW`: Longitude direction ("E" or "W")
- `latG/latM/latS`: Latitude degrees/minutes/seconds
- `latNS`: Latitude direction ("N" or "S")
- `iHouse`: House system ('P'=Placidus, 'K'=Koch, 'W'=Whole Sign, etc.)

**Returns:** JSON string with planets, houses, and angles

#### `getPlanets(year, month, day, hour, minute, second)`

Calculate planetary positions only (no houses).

**Returns:** JSON string with planetary data

#### `getHouses(year, month, day, hour, minute, second, lonG, lonM, lonS, lonEW, latG, latM, latS, latNS, iHouse)`

Calculate house cusps and angles only (no planets).

**Returns:** JSON string with house cusps and angles

### Specialized Functions

#### `getPlanetaryNodes(year, month, day, hour, minute, second, method, buflen)`

Calculate nodes and apsides for all major planets.

**Method values:**
- `0`: Mean elements (Sun-Neptune), osculating (Pluto+)
- `1`: Osculating elements for all planets
- `2`: Barycentric osculating for outer planets
- `4`: Focal points instead of aphelia

#### `getAsteroids(year, month, day, hour, minute, second, start_num, end_num, buflen)`

Calculate positions for a range of asteroids (1-1000).

#### `getSpecificAsteroids(year, month, day, hour, minute, second, asteroid_list, buflen)`

Calculate positions for specific asteroids by catalog numbers.

**Example:**
```javascript
const asteroids = Module.ccall('getSpecificAsteroids', 'string',
  ['number', 'number', 'number', 'number', 'number', 'number', 'string', 'number'],
  [2023, 12, 25, 12, 0, 0, "1,2,3,4,433", 20000]);
```

### Utility Functions

#### `getJulianDay(year, month, day, hour, minute, second)`

Convert calendar date to Julian Day number.

#### `degreesToDMS(degrees, format)`

Convert decimal degrees to degrees/minutes/seconds format.

**Format flags:**
- `1`: Round to seconds
- `2`: Round to minutes
- `4`: Use zodiac signs

#### `freeMemory(pointer)`

Free memory allocated by other functions. **Always call this** after processing results to prevent memory leaks.

## House Systems

The library supports multiple house systems via the `iHouse` parameter:

| Code | System | Description |
|------|--------|-------------|
| 'P' | Placidus | Most common modern system |
| 'K' | Koch | Popular in Europe |
| 'O' | Porphyrius | Ancient system |
| 'R' | Regiomontanus | Medieval system |
| 'C' | Campanus | Medieval system |
| 'W' | Whole Sign | Ancient system |
| 'E' | Equal | Simple 30° divisions |
| 'B' | Alcabitus | Medieval system |
| 'T' | Topocentric | Modern system |

## Coordinate Systems

- **Longitude**: 0-360° (Aries 0° to Pisces 30°)
- **Latitude**: -90° to +90° (negative = south of ecliptic)
- **Distance**: Astronomical Units (AU) from Earth
- **Speed**: Degrees per day and AU per day
- **Reference Frame**: Geocentric, tropical zodiac, mean ecliptic of date

## Build System

### Prerequisites

- [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html)
- Swiss Ephemeris source code in `../sweph/src/`
- Ephemeris data files in `eph/` directory

### Build Targets

```bash
make embedded     # Single-file production build (recommended)
make development  # Multi-file debug build
make install      # Install embedded build to ../../js/
make install-dev  # Install development build
make verify       # Verify build integrity
make clean        # Remove build artifacts
make info         # Show build information
```

### Configuration

The build system uses these key variables:

- `SWEPHDIR`: Swiss Ephemeris source directory
- `EPHDIR`: Ephemeris data directory
- `JSDIR`: Installation target directory

## Performance Characteristics

### Memory Usage

- **Initial Memory**: 64MB allocated
- **Stack Size**: 1MB
- **Growth**: Fixed size (no dynamic growth for predictable performance)

### File Sizes

- **Embedded Build**: ~45-50MB (includes all ephemeris data)
- **Development Build**: ~15MB JavaScript + ~35MB data file
- **Ephemeris Data**: ~35MB (49 files covering 6000 years)

### Calculation Speed

- **Single Planet**: <1ms
- **Complete Chart**: 5-10ms
- **All Asteroids (1-1000)**: 50-100ms

## Error Handling

All functions return JSON with error information:

```javascript
{
  "error": true,
  "error_msg": "Error description",
  // ... other fields may be zero/empty
}
```

Common error conditions:
- Invalid dates (outside ephemeris range)
- Missing ephemeris files for specific objects
- Invalid coordinate values
- Buffer overflow (increase `buflen` parameter)

## Memory Management

**Critical**: Always free allocated memory to prevent leaks:

```javascript
// Correct usage pattern
const result = Module.ccall('get', 'string', [...], [...]);
const data = JSON.parse(result);
// ... process data ...
Module.ccall('freeMemory', null, ['number'], [result]);
```

For long-running applications, consider:
- Batching calculations
- Regular memory cleanup
- Monitoring memory usage with browser dev tools

## Accuracy and Limitations

### Date Ranges

- **Highest Accuracy**: 1800-2400 CE (Swiss Ephemeris primary range)
- **Extended Range**: 3000 BCE - 3000 CE (reduced accuracy outside primary range)
- **Calendar**: Gregorian calendar for all dates

### Precision

- **Major Planets**: Arc-second accuracy in primary range
- **Moon**: Arc-second accuracy
- **Asteroids**: Variable (depends on orbital elements availability)
- **Houses**: Depends on birth time accuracy (1 minute ≈ 0.25° error)

### Known Limitations

- Earth is skipped in planetary calculations (geocentric viewpoint)
- Some asteroids may not be available in all time periods
- Heliocentric calculations not directly supported
- Sidereal zodiac requires additional offset calculations

## Examples

### Basic Birth Chart

```javascript
// Birth chart for New York, January 1, 2000, 12:00 PM
const chart = Module.ccall('get', 'string',
  ['number', 'number', 'number', 'number', 'number', 'number',
   'number', 'number', 'number', 'string', 'number', 'number', 'number', 'string', 'string'],
  [2000, 1, 1, 12, 0, 0, 73, 59, 0, "W", 40, 45, 0, "N", "P"]);

const data = JSON.parse(chart);

// Access planetary positions
data.planets.forEach(planet => {
  console.log(`${planet.name}: ${planet.long_s} (${planet.long.toFixed(2)}°)`);
});

// Access house cusps
data.houses.forEach((house, index) => {
  console.log(`House ${index + 1}: ${house.long_s} (${house.long.toFixed(2)}°)`);
});

Module.ccall('freeMemory', null, ['number'], [chart]);
```

### Planetary Nodes

```javascript
// Calculate nodes for all planets on a specific date
const nodes = Module.ccall('getPlanetaryNodes', 'string',
  ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
  [2023, 6, 21, 12, 0, 0, 1, 50000]);

const nodeData = JSON.parse(nodes);

nodeData.nodes.forEach(planet => {
  if (!planet.error) {
    console.log(`${planet.name} North Node: ${planet.ascending_node.long_s}`);
    console.log(`${planet.name} South Node: ${planet.descending_node.long_s}`);
  }
});

Module.ccall('freeMemory', null, ['number'], [nodes]);
```

### Asteroid Positions

```javascript
// Get positions for main asteroids
const asteroids = Module.ccall('getSpecificAsteroids', 'string',
  ['number', 'number', 'number', 'number', 'number', 'number', 'string', 'number'],
  [2023, 12, 25, 0, 0, 0, "1,2,3,4,5,433,1566", 20000]);

const asteroidData = JSON.parse(asteroids);

asteroidData.asteroids.forEach(asteroid => {
  if (!asteroid.error) {
    console.log(`${asteroid.name}: ${asteroid.long_s}`);
  }
});

Module.ccall('freeMemory', null, ['number'], [asteroids]);
```

## License

This project maintains the same license as the original Swiss Ephemeris:

- Swiss Ephemeris: Dual licensed (GPL/Commercial)
- This WebAssembly interface: MIT License

See the Swiss Ephemeris documentation for complete licensing information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with appropriate tests
4. Update documentation
5. Submit a pull request

## Support

For issues related to:
- **Build system**: Check Emscripten installation and ephemeris files
- **Calculations**: Verify input parameters and date ranges
- **Performance**: Consider using specific functions instead of complete charts
- **Memory**: Ensure proper freeMemory() usage

## Version History

### v2.0.0
- Refactored for WebAssembly-only deployment
- Improved documentation and API consistency
- Enhanced build system with better error handling
- Optimized memory management
- Added comprehensive examples and usage patterns 