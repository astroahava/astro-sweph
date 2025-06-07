# Changelog

## 22/04/2023

- Improved typo in readme.md
- new feature: ephemeris in json format
- mod: index.html
- mod: calculate.js
- mod: astro.c
- delete section To Do in Readme


## 21/04/2023

- Added ability to preload wasm data
- add: js/preloadData.js
- add: js/swephPreload.js
- add: section in readme.md - Preload Data
- mod: index.html for preload data


## 20/04/2023

- Initial commit


## [2024-06-07] - Compressed Asteroid Test Interface

### Added
- **Compressed asteroid version**: 613KB single-file build with full functionality
- **Asteroid support**: 46 asteroids (5-50) included in compressed build
- **Updated test interface**: `index.html` now uses compressed version by default
- **Asteroid selection UI**: Three modes for asteroid calculation:
  - All 46 asteroids (default)
  - Range selection within 5-50
  - Custom asteroid selection
- **Quick test page**: `test-compressed.html` for verification
- **Input validation**: Ensures only available asteroids (5-50) are requested

### Changed
- **Default configuration**: Asteroids now enabled by default in test interface
- **File loading**: `js/sweph.js` worker now loads `astro-asteroids-release.js`
- **Popular asteroids list**: Updated to show all 46 available asteroids (5-50)
- **Range inputs**: Constrained to available asteroid range (5-50)
- **UI labels**: Updated to reflect compressed build capabilities

### Technical Details
- **File size**: 613KB (96% reduction from 5.6MB original)
- **Compression**: Single-file build with LZ4 + Closure Compiler
- **Coverage**: Planets + 46 asteroids + nodes/apsides + houses
- **Performance**: Same calculation speed, dramatically reduced download time
- **Compatibility**: Drop-in replacement for original version

### Files Modified
- `index.html` - Updated UI and descriptions for compressed version
- `js/sweph.js` - Changed to load compressed asteroid version
- `js/calculate.js` - Updated asteroid list and validation
- `README.md` - Added testing documentation
- `test-compressed.html` - New quick test page

### Build Targets Used
- `make astro-asteroids-release` - Creates compressed asteroid version
- `make install-asteroids-release` - Installs to js/ directory

This update provides a production-ready test interface that demonstrates the full capabilities of the compressed Swiss Ephemeris WASM build, including comprehensive asteroid support in a highly optimized package.

