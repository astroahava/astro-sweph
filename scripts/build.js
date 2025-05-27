const fs = require('fs');
const path = require('path');
const copyfiles = require('copyfiles');
const mkdirp = require('mkdirp');

// Create dist directory
mkdirp.sync('dist');

// Create a more comprehensive index.js for the npm package
const indexContent = `// Astro-Sweph - Swiss Ephemeris WebAssembly Package

class AstroSweph {
  constructor(options = {}) {
    this.Module = null;
    this.initialized = false;
    this.basePath = options.basePath || null; // Allow custom base path
  }

  async initialize() {
    if (this.initialized) return this;

    return new Promise((resolve, reject) => {
      // Set up Module configuration
      const Module = {
        locateFile: (s) => {
          // Return the correct path based on environment
          if (typeof window !== 'undefined') {
            // Use custom base path if provided
            if (this.basePath) {
              console.log('Using custom base path:', this.basePath + s);
              return this.basePath + s;
            }
            
            // Try to determine base path from script location
            const currentScript = document.currentScript;
            if (currentScript) {
              const scriptPath = currentScript.src;
              const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
              console.log('Base path for WASM files:', basePath + s);
              return basePath + s;
            }
            
            // Try common serving patterns
            const possiblePaths = [
              './dist/' + s,           // Relative to document root
              '/astro-sweph/' + s,     // Served from /astro-sweph/ 
              './' + s                 // Same directory
            ];
            
            console.log('Trying fallback paths for:', s);
            // We'll return the first path, but the actual file loading will try multiple paths
            return possiblePaths[0];
          } else {
            // Node.js environment
            return s;
          }
        },
        onRuntimeInitialized: () => {
          this.Module = Module;
          this.initialized = true;
          console.log('WASM Runtime initialized successfully');
          resolve(this);
        },
        onAbort: (what) => {
          console.error('WASM initialization aborted:', what);
          reject(new Error('WASM module failed to initialize: ' + what));
        },
        print: function(text) {
          console.log('WASM:', text);
        },
        printErr: function(text) {
          console.error('WASM Error:', text);
        }
      };

      // Load the WASM module
      if (typeof window !== 'undefined') {
        // Browser environment
        this._loadAstroJS(Module, resolve, reject);
      } else {
        // Node.js environment
        try {
          global.Module = Module;
          require('./astro.js');
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  _loadAstroJS(Module, resolve, reject) {
    // Set global Module before loading astro.js
    window.Module = Module;
    
    // Determine possible paths for astro.js
    let possiblePaths = [];
    
    // Use custom base path if provided
    if (this.basePath) {
      possiblePaths.push(this.basePath + 'astro.js');
    }
    
    // Try to get path from current script
    const currentScript = document.currentScript;
    if (currentScript) {
      const scriptPath = currentScript.src;
      const basePath = scriptPath.substring(0, scriptPath.lastIndexOf('/') + 1);
      possiblePaths.push(basePath + 'astro.js');
    }
    
    // Add common fallback paths
    possiblePaths.push(
      './dist/astro.js',      // Relative to document root
      '/astro-sweph/astro.js', // Served from /astro-sweph/
      './astro.js'            // Same directory
    );
    
    // Remove duplicates
    possiblePaths = [...new Set(possiblePaths)];
    
    console.log('Trying to load astro.js from paths:', possiblePaths);
    
    this._tryLoadScript(possiblePaths, 0, resolve, reject);
  }

  _tryLoadScript(paths, index, resolve, reject) {
    if (index >= paths.length) {
      reject(new Error('Failed to load astro.js from any of the attempted paths: ' + paths.join(', ')));
      return;
    }
    
    const currentPath = paths[index];
    console.log(\`Attempting to load astro.js from: \${currentPath} (attempt \${index + 1}/\${paths.length})\`);
    
    const script = document.createElement('script');
    script.src = currentPath;
    
    script.onload = () => {
      console.log('astro.js loaded successfully from:', currentPath);
    };
    
    script.onerror = (error) => {
      console.warn(\`Failed to load astro.js from: \${currentPath}\`);
      // Try next path
      this._tryLoadScript(paths, index + 1, resolve, reject);
    };
    
    document.head.appendChild(script);
  }

  // Main calculation function
  calculate(params) {
    if (!this.initialized || !this.Module) {
      throw new Error('AstroSweph not initialized. Call initialize() first.');
    }

    const {
      year, month, day, hour, minute, second,
      lonG, lonM, lonS, lonEW,
      latG, latM, latS, latNS,
      houseSystem,
      calculateNodes = false,
      nodeMethod = 0,
      asteroidData = null
    } = params;

    try {
      // Call the main calculation function
      const calc = this.Module.ccall(
        "get",
        "string",
        ["number", "number", "number", "number", "number", "number", 
         "number", "number", "number", "string", 
         "number", "number", "number", "string", "string"],
        [year, month, day, hour, minute, second, 
         lonG, lonM, lonS, lonEW, 
         latG, latM, latS, latNS, 
         houseSystem]
      );

      let result = JSON.parse(calc);

      // Calculate nodes if requested
      if (calculateNodes) {
        try {
          const nodesResult = this.Module.ccall('getPlanetaryNodes', 'string',
            ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
            [year, month, day, hour, minute, second, nodeMethod, 50000]);
          
          result.nodes = JSON.parse(nodesResult);
        } catch (error) {
          console.error('Error calculating planetary nodes:', error);
          result.nodes = {
            error: true,
            error_msg: 'Failed to calculate planetary nodes: ' + error.message
          };
        }
      }

      // Calculate asteroids if requested
      if (asteroidData) {
        try {
          let asteroidsResult;
          
          if (asteroidData.mode === "range") {
            asteroidsResult = this.Module.ccall('getAsteroids', 'string',
              ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
              [year, month, day, hour, minute, second, 
               asteroidData.start, asteroidData.end, 100000]);
          } else if (asteroidData.mode === "specific") {
            asteroidsResult = this.Module.ccall('getSpecificAsteroids', 'string',
              ['number', 'number', 'number', 'number', 'number', 'number', 'string', 'number'],
              [year, month, day, hour, minute, second, 
               asteroidData.list, 100000]);
          }
          
          if (asteroidsResult) {
            result.asteroids = JSON.parse(asteroidsResult);
          }
        } catch (error) {
          console.error('Error calculating asteroids:', error);
          result.asteroids = {
            error: true,
            error_msg: 'Failed to calculate asteroids: ' + error.message
          };
        }
      }

      return result;
    } catch (error) {
      throw new Error('Calculation failed: ' + error.message);
    }
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = AstroSweph;
} else if (typeof window !== 'undefined') {
  // Browser
  window.AstroSweph = AstroSweph;
}`;

fs.writeFileSync(path.join('dist', 'index.js'), indexContent);

// Create TypeScript definitions (updated)
const typeDefinitions = `export interface AstroSwephOptions {
  basePath?: string;
}

export interface CalculationParams {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  lonG: number;
  lonM: number;
  lonS: number;
  lonEW: string;
  latG: number;
  latM: number;
  latS: number;
  latNS: string;
  houseSystem: string;
  calculateNodes?: boolean;
  nodeMethod?: number;
  asteroidData?: {
    mode: 'range' | 'specific';
    start?: number;
    end?: number;
    list?: string;
  } | null;
}

export interface CalculationResult {
  planets: Array<any>;
  houses: Array<any>;
  ascmc: Array<any>;
  nodes?: any;
  asteroids?: any;
  error?: boolean;
  error_msg?: string;
}

declare class AstroSweph {
  constructor(options?: AstroSwephOptions);
  initialize(): Promise<AstroSweph>;
  calculate(params: CalculationParams): CalculationResult;
}

export default AstroSweph;`;

fs.writeFileSync(path.join('dist', 'index.d.ts'), typeDefinitions);

// Copy WASM and data files
copyfiles([
  'js/astro.wasm',
  'js/astro.data',
  'js/astro.js',
  'dist'
], true, (err) => {
  if (err) {
    console.error('Error copying files:', err);
    process.exit(1);
  }
  console.log('Build completed successfully!');
  console.log('Files in dist directory:');
  const files = fs.readdirSync('dist');
  files.forEach(file => {
    const stats = fs.statSync(path.join('dist', file));
    console.log(`  ${file} (${Math.round(stats.size / 1024)}KB)`);
  });
}); 