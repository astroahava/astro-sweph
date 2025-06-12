/**
 * Swiss Ephemeris WebAssembly Calculator
 * 
 * A modern, memory-efficient interface to Swiss Ephemeris calculations
 * with automatic lazy loading and memory management.
 * 
 * @example
 * const calculator = new SwissEphemeris();
 * 
 * // Basic calculation
 * const chart = await calculator.calculate({
 *   date: '2023-12-25',
 *   time: '12:00',
 *   longitude: { degrees: 0, minutes: 0, seconds: 0, direction: 'E' },
 *   latitude: { degrees: 51, minutes: 30, seconds: 0, direction: 'N' },
 *   houseSystem: 'P'
 * });
 * 
 * // With nodes and asteroids
 * const fullChart = await calculator.calculateFull({
 *   date: '2023-12-25',
 *   time: '12:00',
 *   longitude: { degrees: 0, minutes: 0, seconds: 0, direction: 'E' },
 *   latitude: { degrees: 51, minutes: 30, seconds: 0, direction: 'N' },
 *   houseSystem: 'P',
 *   includeNodes: true,
 *   nodeMethod: 0,
 *   asteroids: { mode: 'popular', selection: [1, 2, 3, 4] }
 * });
 */
class SwissEphemeris {
    constructor(options = {}) {
        this.options = {
            workerPath: 'js/sweph-worker.js',
            autoCleanup: true,
            memoryOptimized: true,
            ...options
        };
        
        this.worker = null;
        this.isCalculating = false;
        this.pendingCalculations = new Map();
        this.calculationId = 0;
        
        console.log('🌟 Swiss Ephemeris Calculator initialized');
    }

    /**
     * Perform a basic astrological calculation
     * @param {Object} params - Calculation parameters
     * @returns {Promise<Object>} Calculation results
     */
    async calculate(params) {
        const data = this._prepareCalculationData(params);
        return this._performCalculation(data);
    }

    /**
     * Perform a full calculation with nodes and asteroids
     * @param {Object} params - Extended calculation parameters
     * @returns {Promise<Object>} Full calculation results
     */
    async calculateFull(params) {
        const data = this._prepareCalculationData(params);
        
        // Add nodes if requested
        if (params.includeNodes) {
            data.calculateNodes = true;
            data.nodeMethod = params.nodeMethod || 0;
        }
        
        // Add asteroids if requested
        if (params.asteroids) {
            data.asteroidData = this._prepareAsteroidData(params.asteroids);
        }
        
        return this._performCalculation(data);
    }

    /**
     * Calculate only planetary positions (no houses)
     * @param {Object} params - Calculation parameters
     * @returns {Promise<Object>} Planetary positions
     */
    async calculatePlanets(params) {
        const data = this._prepareBasicData(params);
        return this._sendWorkerCommand('calculatePlanets', data);
    }

    /**
     * Calculate planetary nodes and apsides
     * @param {Object} params - Calculation parameters
     * @returns {Promise<Object>} Nodes and apsides
     */
    async calculateNodes(params) {
        const data = this._prepareBasicData(params);
        data.method = params.nodeMethod || 0;
        return this._sendWorkerCommand('calculateNodes', data);
    }

    /**
     * Calculate asteroid positions
     * @param {Object} params - Calculation parameters with asteroid specification
     * @returns {Promise<Object>} Asteroid positions
     */
    async calculateAsteroids(params) {
        const data = this._prepareBasicData(params);
        data.asteroidData = this._prepareAsteroidData(params.asteroids);
        return this._sendWorkerCommand('calculateAsteroids', data);
    }

    /**
     * Preload the WASM module for faster calculations
     * @returns {Promise<void>}
     */
    async preload() {
        console.log('🚀 Preloading WASM module...');
        const result = await this._sendWorkerCommand('preload');
        if (result.success) {
            console.log('✅ WASM module preloaded');
        } else {
            throw new Error(`Preload failed: ${result.error}`);
        }
    }

    /**
     * Get current memory and loading status
     * @returns {Promise<Object>} Status information
     */
    async getStatus() {
        return this._sendWorkerCommand('status');
    }

    /**
     * Unload WASM module to free memory
     * @returns {Promise<void>}
     */
    async unload() {
        console.log('🗑️ Unloading WASM module...');
        const result = await this._sendWorkerCommand('unload');
        if (result.success) {
            console.log('✅ WASM module unloaded');
        }
    }

    /**
     * Clean up all resources
     */
    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingCalculations.clear();
        console.log('🧹 Swiss Ephemeris Calculator destroyed');
    }

    // Private methods

    _ensureWorker() {
        if (!this.worker) {
            this.worker = new Worker(this.options.workerPath);
            this.worker.onmessage = (event) => this._handleWorkerMessage(event);
            this.worker.onerror = (error) => this._handleWorkerError(error);
        }
    }

    _prepareCalculationData(params) {
        // Convert user-friendly params to internal format
        const date = new Date(params.date + 'T' + (params.time || '12:00'));
        
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds(),
            lonG: params.longitude.degrees,
            lonM: params.longitude.minutes,
            lonS: params.longitude.seconds,
            lonEW: params.longitude.direction,
            latG: params.latitude.degrees,
            latM: params.latitude.minutes,
            latS: params.latitude.seconds,
            latNS: params.latitude.direction,
            houseSystem: params.houseSystem || 'P'
        };
    }

    _prepareBasicData(params) {
        const date = new Date(params.date + 'T' + (params.time || '12:00'));
        
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds()
        };
    }

    _prepareAsteroidData(asteroidConfig) {
        if (!asteroidConfig) return null;

        switch (asteroidConfig.mode) {
            case 'range':
                return {
                    mode: 'range',
                    start: asteroidConfig.start,
                    end: asteroidConfig.end
                };
            
            case 'specific':
            case 'popular':
                return {
                    mode: 'specific',
                    list: Array.isArray(asteroidConfig.selection) 
                        ? asteroidConfig.selection.join(',')
                        : asteroidConfig.selection
                };
            
            default:
                throw new Error(`Unknown asteroid mode: ${asteroidConfig.mode}`);
        }
    }

    async _performCalculation(data) {
        // Convert to legacy array format for the worker
        const workerData = [
            data.year, data.month, data.day, data.hour, data.minute, data.second,
            data.lonG, data.lonM, data.lonS, data.lonEW,
            data.latG, data.latM, data.latS, data.latNS,
            data.houseSystem, data.calculateNodes || false, data.nodeMethod || 0, data.asteroidData || null
        ];

        return this._sendWorkerData(workerData);
    }

    async _sendWorkerCommand(command, data = {}) {
        this._ensureWorker();
        
        const id = ++this.calculationId;
        const message = { command, ...data, _id: id };
        
        return new Promise((resolve, reject) => {
            this.pendingCalculations.set(id, { resolve, reject });
            this.worker.postMessage(message);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingCalculations.has(id)) {
                    this.pendingCalculations.delete(id);
                    reject(new Error('Calculation timeout'));
                }
            }, 30000);
        });
    }

    async _sendWorkerData(data) {
        this._ensureWorker();
        
        const id = ++this.calculationId;
        
        return new Promise((resolve, reject) => {
            this.pendingCalculations.set(id, { resolve, reject });
            
            // Store the ID with the data array (workers expect arrays for calculations)
            data._calculationId = id;
            this.worker.postMessage(data);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                if (this.pendingCalculations.has(id)) {
                    this.pendingCalculations.delete(id);
                    reject(new Error('Calculation timeout'));
                }
            }, 30000);
        });
    }

    _handleWorkerMessage(event) {
        try {
            const result = JSON.parse(event.data);
            
            // Handle command responses
            if (result.command && result._id) {
                const pending = this.pendingCalculations.get(result._id);
                if (pending) {
                    this.pendingCalculations.delete(result._id);
                    pending.resolve(result);
                }
                return;
            }
            
            // Handle calculation responses (find by ID in result or use latest)
            const calculationId = result._calculationId || this.calculationId;
            const pending = this.pendingCalculations.get(calculationId);
            
            if (pending) {
                this.pendingCalculations.delete(calculationId);
                
                if (result.error) {
                    pending.reject(new Error(result.error_msg || 'Calculation failed'));
                } else {
                    pending.resolve(result);
                }
            }

            // Auto-cleanup if enabled
            if (this.options.autoCleanup && this.options.memoryOptimized) {
                setTimeout(() => {
                    if (this.pendingCalculations.size === 0) {
                        this.worker.terminate();
                        this.worker = null;
                        console.log('🧹 Worker auto-terminated for memory efficiency');
                    }
                }, 1000);
            }

        } catch (error) {
            console.error('❌ Error parsing worker response:', error);
        }
    }

    _handleWorkerError(error) {
        console.error('❌ Worker error:', error);
        
        // Reject all pending calculations
        for (const [id, pending] of this.pendingCalculations) {
            pending.reject(new Error(`Worker error: ${error.message}`));
        }
        this.pendingCalculations.clear();
        
        // Reset worker
        this.worker = null;
    }
}

// Static utility methods
SwissEphemeris.validateDate = function(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.getFullYear() >= 600 && date.getFullYear() <= 2400;
};

SwissEphemeris.formatCoordinate = function(degrees, minutes, seconds, direction) {
    return { degrees, minutes, seconds, direction };
};

SwissEphemeris.parseCoordinate = function(coordinateString) {
    // Parse coordinate strings like "51°30'0\"N" or "0°0'0\"E"
    const match = coordinateString.match(/(\d+)°(\d+)'(\d+)"([NSEW])/);
    if (!match) throw new Error('Invalid coordinate format');
    
    return {
        degrees: parseInt(match[1]),
        minutes: parseInt(match[2]),
        seconds: parseInt(match[3]),
        direction: match[4]
    };
};

// Export for use in browsers or Node.js
if (typeof window !== 'undefined') {
    window.SwissEphemeris = SwissEphemeris;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = SwissEphemeris;
}

// Memory-efficient Swiss Ephemeris Worker with Lazy Loading
// Only loads WASM module when calculations are actually needed

var pendingData = null;
var isModuleLoaded = false;
var isModuleLoading = false;
var moduleLoadPromise = null;

console.log('🔧 Swiss Ephemeris Worker ready (WASM not loaded yet)');

// Handle messages from the main thread
self.onmessage = function(event) {
    const data = event.data;
    
    // Check if this is a command instead of calculation data
    if (data && typeof data === 'object' && data.command) {
        handleCommand(data);
        return;
    }
    
    console.log('📨 Worker received calculation request');
    
    if (isModuleLoaded) {
        // Module already loaded, process immediately
        processData(data);
    } else if (isModuleLoading) {
        // Module is currently loading, queue the request
        console.log('⏳ Module loading, queuing request...');
        pendingData = data;
    } else {
        // Module not loaded, start loading and queue request
        console.log('🔄 Loading WASM module on demand...');
        pendingData = data;
        loadModuleAsync();
    }
};

// Handle commands from main thread
function handleCommand(data) {
    const response = { command: data.command, _id: data._id };
    
    switch (data.command) {
        case 'unload':
            console.log('📨 Received unload command');
            unloadModule();
            postMessage(JSON.stringify({ ...response, success: true }));
            break;
            
        case 'status':
            console.log('📨 Received status command');
            postMessage(JSON.stringify({ 
                ...response,
                isLoaded: isModuleLoaded,
                isLoading: isModuleLoading,
                hasPendingData: !!pendingData
            }));
            break;
            
        case 'preload':
            console.log('📨 Received preload command');
            if (!isModuleLoaded && !isModuleLoading) {
                loadModuleAsync().then(() => {
                    postMessage(JSON.stringify({ ...response, success: true }));
                }).catch((error) => {
                    postMessage(JSON.stringify({ 
                        ...response, 
                        success: false, 
                        error: error.message 
                    }));
                });
            } else {
                postMessage(JSON.stringify({ ...response, success: true, already_loaded: true }));
            }
            break;
            
        default:
            console.warn('❓ Unknown command:', data.command);
            postMessage(JSON.stringify({ 
                ...response, 
                success: false, 
                error: 'Unknown command' 
            }));
    }
}

// Lazy load the WASM module
function loadModuleAsync() {
    if (isModuleLoading || isModuleLoaded) {
        return moduleLoadPromise;
    }
    
    isModuleLoading = true;
    
    moduleLoadPromise = new Promise((resolve, reject) => {
        console.log('📦 Starting WASM module loading...');
        
        // Configure Module before loading
        self.Module = {
            locateFile: function(path) {
                return path;
            },
            
            onRuntimeInitialized: function() {
                console.log('✅ WASM Runtime initialized');
                isModuleLoaded = true;
                isModuleLoading = false;
                
                // Process any pending data
                if (pendingData) {
                    console.log('🔄 Processing queued calculation...');
                    processData(pendingData);
                    pendingData = null;
                }
                
                resolve();
            },
            
            onAbort: function(what) {
                console.error('❌ WASM module aborted:', what);
                isModuleLoading = false;
                isModuleLoaded = false;
                
                postMessage(JSON.stringify({
                    error: true,
                    error_msg: 'WASM module failed to load: ' + what
                }));
                
                reject(new Error('WASM module aborted: ' + what));
            },
            
            postRun: function() {
                console.log('🏁 WASM postRun completed');
                
                // Double-check module readiness
                if (Module.ccall && !isModuleLoaded) {
                    console.log('✅ Module ccall ready, finalizing...');
                    isModuleLoaded = true;
                    isModuleLoading = false;
                    
                    if (pendingData) {
                        processData(pendingData);
                        pendingData = null;
                    }
                }
            },
            
            noInitialRun: false,
            noExitRuntime: false,  // Allow cleanup
            
            // Memory optimization settings
            print: function() {}, // Disable console output
            printErr: function() {}, // Disable error output
        };
        
        // Dynamically import the WASM script
        try {
            importScripts('astro-embedded.js');
            console.log('📜 WASM script imported successfully');
        } catch (error) {
            console.error('❌ Failed to import WASM script:', error);
            isModuleLoading = false;
            isModuleLoaded = false;
            
            postMessage(JSON.stringify({
                error: true,
                error_msg: 'Failed to load WASM script: ' + error.message
            }));
            
            reject(error);
        }
    });
    
    return moduleLoadPromise;
}

// Function to process the calculation data
function processData(data) {
    try {
        if (!isModuleLoaded || !Module || typeof Module._get !== 'function') {
            throw new Error('WASM module not ready or functions not available');
        }
        
        console.log('🔄 Starting calculations...');
        
        // Main calculation
        console.log('📍 Calling main calculation...');
        const resultPtr = Module._get(data[0], data[1], data[2], data[3], data[4], data[5], 
                                     data[6], data[7], data[8], data[9], data[10], data[11], 
                                     data[12], data[13], data[14]);
        const result = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
        
        var mainResult = JSON.parse(result);
        console.log('🌍 Main calculation completed');
        
        // Get additional calculation parameters
        var calculateNodes = data[15] || false;
        var nodeMethod = data[16] || 0;
        var asteroidData = data[17] || null;
        
        // Calculate nodes if requested
        if (calculateNodes) {
            console.log('🔗 Calculating planetary nodes...');
            try {
                const nodesPtr = Module._getPlanetaryNodes(data[0], data[1], data[2], data[3], 
                                                          data[4], data[5], nodeMethod, 50000);
                const nodesResult = typeof nodesPtr === 'number' ? Module.UTF8ToString(nodesPtr) : nodesPtr;
                mainResult.nodes = JSON.parse(nodesResult);
                console.log('✅ Nodes calculated');
            } catch (error) {
                console.error('❌ Error calculating nodes:', error);
                mainResult.nodes = {
                    error: true,
                    error_msg: 'Failed to calculate nodes: ' + error.message
                };
            }
        }
        
        // Calculate asteroids if requested
        if (asteroidData) {
            console.log('☄️ Calculating asteroids...');
            
            try {
                var asteroidsResult;
                
                if (asteroidData.mode === 'range') {
                    console.log('📍 Range calculation:', asteroidData.start, '-', asteroidData.end);
                    const asteroidsPtr = Module._getAsteroids(data[0], data[1], data[2], data[3], 
                                                            data[4], data[5], asteroidData.start, 
                                                            asteroidData.end, 100000);
                    asteroidsResult = typeof asteroidsPtr === 'number' ? Module.UTF8ToString(asteroidsPtr) : asteroidsPtr;
                } else if (asteroidData.mode === 'specific') {
                    console.log('📍 Specific asteroids:', asteroidData.list);
                    
                    // Allocate string in WASM memory
                    const listStr = asteroidData.list;
                    const strLen = Module.lengthBytesUTF8(listStr) + 1;
                    const strPtr = Module._malloc(strLen);
                    Module.stringToUTF8(listStr, strPtr, strLen);
                    
                    try {
                        const asteroidsPtr = Module._getSpecificAsteroids(data[0], data[1], data[2], 
                                                                         data[3], data[4], data[5], 
                                                                         strPtr, 100000);
                        asteroidsResult = typeof asteroidsPtr === 'number' ? Module.UTF8ToString(asteroidsPtr) : asteroidsPtr;
                    } finally {
                        Module._free(strPtr);
                    }
                }
                
                if (asteroidsResult) {
                    mainResult.asteroids = JSON.parse(asteroidsResult);
                    console.log('✅ Asteroids calculated');
                }
            } catch (error) {
                console.error('❌ Error calculating asteroids:', error);
                mainResult.asteroids = {
                    error: true,
                    error_msg: 'Failed to calculate asteroids: ' + error.message
                };
            }
        }
        
        // Add calculation ID if present
        if (data._calculationId) {
            mainResult._calculationId = data._calculationId;
        }
        
        console.log('🎉 Sending results to main thread');
        postMessage(JSON.stringify(mainResult));
        
        // Optional: Cleanup after calculation to free memory
        performCleanup();
        
    } catch (error) {
        console.error('❌ Fatal error in processData:', error);
        const errorResult = {
            error: true,
            error_msg: 'Calculation failed: ' + error.message
        };
        
        if (data._calculationId) {
            errorResult._calculationId = data._calculationId;
        }
        
        postMessage(JSON.stringify(errorResult));
        
        // Reset module state on error
        resetModule();
    }
}

// Cleanup function to free memory after calculations
function performCleanup() {
    try {
        if (Module && Module._swe_close) {
            // Close Swiss Ephemeris to free file handles and cached data
            Module._swe_close();
            console.log('🧹 Swiss Ephemeris closed, memory freed');
        }
        
        // Force garbage collection if available
        if (typeof gc === 'function') {
            gc();
        }
        
    } catch (error) {
        console.warn('⚠️ Cleanup warning:', error);
    }
}

// Reset module state (for error recovery)
function resetModule() {
    console.log('🔄 Resetting module state...');
    isModuleLoaded = false;
    isModuleLoading = false;
    moduleLoadPromise = null;
    pendingData = null;
    
    try {
        if (self.Module) {
            delete self.Module;
        }
    } catch (error) {
        console.warn('⚠️ Module cleanup warning:', error);
    }
}

// Optional: Add a command to manually unload the module for extreme memory efficiency
// This could be called from the main thread if needed
function unloadModule() {
    console.log('🗑️ Manually unloading WASM module...');
    
    performCleanup();
    resetModule();
    
    // Force garbage collection
    if (typeof gc === 'function') {
        gc();
    }
    
    console.log('✅ Module unloaded, memory freed');
}
