// Initialize variables
var pendingData = null;
var isReady = false;

// Define Module configuration BEFORE importing the script
var Module = {
    locateFile: function(path) {
        return path;
    },
    
    onRuntimeInitialized: function() {
        console.log('✅ WASM Runtime initialized');
        isReady = true;
        
        // Process any pending data
        if (pendingData) {
            processData(pendingData);
            pendingData = null;
        }
    },
    
    onAbort: function(what) {
        console.error('❌ WASM module aborted:', what);
        postMessage(JSON.stringify({
            error: true,
            error_msg: 'WASM module aborted: ' + what
        }));
    },
    
    postRun: function() {
        console.log('🏁 WASM postRun completed');
        
        // Check if ccall is available and set ready state
        if (Module.ccall && !isReady) {
            console.log('✅ Module is ready! ccall available.');
            isReady = true;
            
            if (pendingData) {
                processData(pendingData);
                pendingData = null;
            }
        }
    },
    
    noInitialRun: false,
    noExitRuntime: true
};

// Make Module available globally
self.Module = Module;

console.log('🔄 Loading WASM module...');

// Import the WASM script
try {
    importScripts('astro-embedded.js');
    console.log('📜 WASM script imported');
} catch (error) {
    console.error('❌ Failed to import WASM script:', error);
    postMessage(JSON.stringify({
        error: true,
        error_msg: 'Failed to load WASM script: ' + error.message
    }));
}

// Handle messages from the main thread
self.onmessage = function(event) {
    console.log('📨 Worker received data');
    
    if (isReady) {
        processData(event.data);
    } else {
        console.log('⏳ Module not ready, storing data...');
        pendingData = event.data;
    }
};

// Function to process the calculation data
function processData(data) {
    try {
        console.log('🔄 Starting calculations...');
        
        // Verify Module functions are available
        if (!Module || typeof Module._get !== 'function') {
            throw new Error('Module functions are not available');
        }
        
        // Main calculation
        console.log('📍 Calling main calculation...');
        const resultPtr = Module._get(data[0], data[1], data[2], data[3], data[4], data[5], 
                                     data[6], data[7], data[8], data[9], data[10], data[11], 
                                     data[12], data[13], data[14]);
        const result = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
        
        var mainResult = JSON.parse(result);
        console.log('🌍 Main calculation result:', mainResult);
        
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
            console.log('🔍 Asteroid request:', asteroidData);
            
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
                    console.log('✅ Asteroids calculated:', mainResult.asteroids.summary || 'No summary');
                }
            } catch (error) {
                console.error('❌ Error calculating asteroids:', error);
                mainResult.asteroids = {
                    error: true,
                    error_msg: 'Failed to calculate asteroids: ' + error.message
                };
            }
        }
        
        // Dump raw data to console
        console.log('📊 RAW CALCULATION DATA:', JSON.stringify(mainResult, null, 2));
        
        console.log('🎉 Sending results to main thread');
        postMessage(JSON.stringify(mainResult));
        
    } catch (error) {
        console.error('❌ Fatal error in processData:', error);
        postMessage(JSON.stringify({
            error: true,
            error_msg: 'Calculation failed: ' + error.message
        }));
    }
}
