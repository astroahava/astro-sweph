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
        this._cleanupTimer = null;
        
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
        // Clear any pending cleanup timer
        if (this._cleanupTimer) {
            clearTimeout(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.pendingCalculations.clear();
        console.log('🧹 Swiss Ephemeris Calculator destroyed');
    }

    // Private methods

    _scheduleAutoCleanup() {
        // Clear any existing cleanup timer
        if (this._cleanupTimer) {
            clearTimeout(this._cleanupTimer);
        }
        
        // Schedule cleanup with a reasonable delay
        this._cleanupTimer = setTimeout(() => {
            if (this.pendingCalculations.size === 0 && this.worker) {
                console.log('🧹 Auto-terminating worker for memory efficiency...');
                this.worker.terminate();
                this.worker = null;
                this._cleanupTimer = null;
                console.log('✅ Worker auto-terminated');
            }
        }, 3000); // 3 second delay to ensure all messages are processed
    }

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
                return {
                    mode: 'specific',
                    list: asteroidConfig.list || asteroidConfig.selection
                };
            
            case 'popular':
                return {
                    mode: 'specific',
                    list: Array.isArray(asteroidConfig.selection) 
                        ? asteroidConfig.selection.join(',')
                        : asteroidConfig.selection || asteroidConfig.list
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
        // Check if worker still exists (avoid race condition with auto-cleanup)
        if (!this.worker) {
            console.warn('⚠️ Received message after worker termination');
            return;
        }
        
        // Cancel any pending cleanup since we're actively processing messages
        if (this._cleanupTimer) {
            clearTimeout(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        
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

            // Auto-cleanup if enabled (with proper cleanup logic)
            if (this.options.autoCleanup && this.options.memoryOptimized) {
                // Use a more reliable cleanup mechanism
                this._scheduleAutoCleanup();
            }

        } catch (error) {
            console.error('❌ Error parsing worker response:', error);
        }
    }

    _handleWorkerError(error) {
        console.error('❌ Worker error:', error);
        
        let errorMessage = `Worker error: ${error.message}`;
        
        // Provide more helpful error messages for common issues
        if (error.message && error.message.includes('compressed')) {
            errorMessage = 'Failed to load Swiss Ephemeris: Compressed file could not be loaded. ' +
                          'This may be due to browser compatibility issues with gzip decompression. ' +
                          'Please try refreshing the page or use a different browser.';
        } else if (error.message && error.message.includes('WASM')) {
            errorMessage = 'Failed to load Swiss Ephemeris: WebAssembly module could not be initialized. ' +
                          'Please ensure your browser supports WebAssembly and try again.';
        }
        
        // Reject all pending calculations
        for (const [id, pending] of this.pendingCalculations) {
            pending.reject(new Error(errorMessage));
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

// Worker code follows below (keep existing worker implementation)
// ================================================================

// Memory-efficient Swiss Ephemeris Worker with Lazy Loading
// Only loads WASM module when calculations are actually needed

var pendingData = null;
var isModuleLoaded = false;
var isModuleLoading = false;
var moduleLoadPromise = null;

console.log('🔧 Swiss Ephemeris Worker ready (WASM not loaded yet)');

// Client-side decompression function
async function loadCompressedScript() {
    try {
        console.log('🔄 Loading Brotli-compressed WASM script...');
        
        // First, try to load a Brotli decompression library
        const brotliLib = await loadBrotliLibrary();
        
        // Fetch compressed file as binary
        const response = await fetch('astro-embedded.js.gz');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const compressedData = await response.arrayBuffer();
        console.log(`📦 Loaded astro-embedded.js.gz (${compressedData.byteLength} bytes)`);
        
        // Decompress using the library
        const decompressedData = await brotliLib.decompress(new Uint8Array(compressedData));
        console.log(`🗜️ Decompressed to ${decompressedData.length} bytes`);
        
        // Convert to string and evaluate
        const jsCode = new TextDecoder().decode(decompressedData);
        console.log(`📜 JavaScript code: ${jsCode.length} characters`);
        
        // Execute the decompressed JavaScript
        eval(jsCode);
        console.log('✅ WASM script executed successfully');
        return;
        
    } catch (error) {
        console.error(`❌ Brotli decompression failed:`, error.message);
        throw new Error(`Failed to load compressed WASM script: ${error.message}`);
    }
}

// Load a lightweight Brotli decompression library
async function loadBrotliLibrary() {
    console.log('🔄 Using native browser decompression directly...');
    // Skip CDN dependency and go straight to native browser support
    return await loadFallbackBrotliLib();
}

// Pure JavaScript gzip decoder (simplified implementation)
async function loadFallbackBrotliLib() {
    console.log('🔄 Using pure JavaScript gzip decoder...');
    return {
        decompress: async (compressedData) => {
            console.log(`🔍 Attempting to decompress ${compressedData.byteLength} bytes...`);
            
            // Check the gzip header
            const header = new Uint8Array(compressedData.slice(0, 10));
            console.log('🔍 File header:', Array.from(header).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
            
            // Verify it's a gzip file (magic number 1f 8b)
            if (header[0] !== 0x1f || header[1] !== 0x8b) {
                throw new Error('Not a valid gzip file');
            }
            
            // Try native DecompressionStream first with better error handling
            if (typeof DecompressionStream !== 'undefined') {
                try {
                    console.log('🔄 Trying improved native gzip decompression...');
                    
                    // Create a more robust stream approach
                    const stream = new DecompressionStream('gzip');
                    const writer = stream.writable.getWriter();
                    const reader = stream.readable.getReader();
                    
                    // Write the data in chunks to avoid issues
                    const chunkSize = 8192;
                    const dataArray = new Uint8Array(compressedData);
                    
                    (async () => {
                        try {
                            for (let offset = 0; offset < dataArray.length; offset += chunkSize) {
                                const chunk = dataArray.slice(offset, offset + chunkSize);
                                await writer.write(chunk);
                            }
                            await writer.close();
                        } catch (err) {
                            await writer.abort(err);
                        }
                    })();
                    
                    // Read the decompressed data
                    const chunks = [];
                    let done = false;
                    while (!done) {
                        const { value, done: readerDone } = await reader.read();
                        done = readerDone;
                        if (value) {
                            chunks.push(value);
                        }
                    }
                    
                    // Combine chunks
                    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
                    const result = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        result.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    console.log(`✅ Native gzip decompression successful: ${result.length} bytes`);
                    return result;
                    
                } catch (error) {
                    console.warn('⚠️ Native decompression failed:', error.message);
                    // Fall through to manual implementation
                }
            }
            
            // Manual gzip decompression using inflate
            console.log('🔄 Attempting manual gzip decompression...');
            return await manualGzipDecompress(new Uint8Array(compressedData));
        }
    };
}

// Manual gzip decompression implementation
async function manualGzipDecompress(data) {
    // Parse gzip header
    let offset = 0;
    
    // Check magic number
    if (data[0] !== 0x1f || data[1] !== 0x8b) {
        throw new Error('Invalid gzip magic number');
    }
    offset += 2;
    
    // Check compression method (should be 8 for deflate)
    if (data[2] !== 8) {
        throw new Error('Unsupported compression method');
    }
    offset += 1;
    
    // Read flags
    const flags = data[3];
    offset += 1;
    
    // Skip modification time (4 bytes), extra flags (1 byte), OS (1 byte)
    offset += 6;
    
    // Handle optional fields based on flags
    if (flags & 0x04) { // FEXTRA
        const extraLen = data[offset] | (data[offset + 1] << 8);
        offset += 2 + extraLen;
    }
    
    if (flags & 0x08) { // FNAME
        while (data[offset] !== 0) offset++;
        offset++;
    }
    
    if (flags & 0x10) { // FCOMMENT  
        while (data[offset] !== 0) offset++;
        offset++;
    }
    
    if (flags & 0x02) { // FHCRC
        offset += 2;
    }
    
    // Extract the deflate data (everything except last 8 bytes which are CRC and size)
    const deflateData = data.slice(offset, data.length - 8);
    
    console.log(`🔍 Extracted ${deflateData.length} bytes of deflate data`);
    
    // Try to decompress the deflate data using DecompressionStream
    if (typeof DecompressionStream !== 'undefined') {
        try {
            console.log('🔄 Trying deflate decompression on extracted data...');
            const stream = new DecompressionStream('deflate');
            const response = new Response(deflateData);
            const decompressed = response.body.pipeThrough(stream);
            const result = await new Response(decompressed).arrayBuffer();
            
            const resultArray = new Uint8Array(result);
            console.log(`✅ Manual deflate decompression successful: ${resultArray.length} bytes`);
            
            return resultArray;
        } catch (error) {
            console.warn('⚠️ Manual deflate failed:', error.message);
        }
    }
    
    throw new Error('Manual gzip decompression failed - no working deflate implementation');
}





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
        
        // Load and decompress WASM script client-side
        loadCompressedScript().then(() => {
            console.log('📜 WASM script loaded and decompressed successfully');
        }).catch((error) => {
            console.error('❌ Failed to load WASM script:', error);
            isModuleLoading = false;
            isModuleLoaded = false;
            
            postMessage(JSON.stringify({
                error: true,
                error_msg: 'Failed to load WASM script: ' + error.message
            }));
            
            reject(error);
        });
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
                    
                    if (!asteroidData.list) {
                        throw new Error('Asteroid list is empty or undefined');
                    }
                    
                    // Allocate string in WASM memory
                    const listStr = String(asteroidData.list);
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
