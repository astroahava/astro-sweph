// Initialize variables
var pendingData = null;
var isReady = false;
var initStartTime = Date.now();

// Define Module configuration BEFORE importing the script
// This is critical for Emscripten to work properly
var Module = {
    locateFile: function(path) {
        console.log('Locating file:', path);
        return path;
    },
    
    onRuntimeInitialized: function() {
        console.log('✅ WASM Runtime fully initialized!');
        console.log('🔍 Module functions after init:', Object.keys(Module).filter(k => k.startsWith('_')));
        isReady = true;
        
        // Process any pending data
        if (pendingData) {
            console.log('Processing pending data after initialization...');
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
    
    print: function(text) {
        console.log('WASM stdout:', text);
    },
    
    printErr: function(text) {
        console.error('WASM stderr:', text);
    },
    
    preInit: function() {
        console.log('🔧 WASM preInit called');
    },
    
    preRun: function() {
        console.log('🏃 WASM preRun called');
    },
    
    postRun: function() {
        console.log('🏁 WASM postRun called');
        console.log('🔍 Module functions after postRun:', Object.keys(Module).filter(k => k.startsWith('_')));
        
        // Check if functions are available and set ready state
        checkModuleReady();
    },
    
    noInitialRun: false,
    noExitRuntime: true
};

// Function to check if module is ready
function checkModuleReady() {
    // Check for key functions that should be available
    const requiredFunctions = ['_get', '_getPlanets', '_getHouses', '_getPlanetaryNodes'];
    const availableFunctions = requiredFunctions.filter(fn => typeof Module[fn] === 'function');
    
    console.log('🔍 Function availability check:');
    requiredFunctions.forEach(fn => {
        console.log(`  - ${fn}: ${typeof Module[fn] === 'function' ? '✅' : '❌'}`);
    });
    
    // More comprehensive module inspection
    console.log('🔍 Comprehensive Module inspection:');
    console.log('  - Module keys:', Object.keys(Module));
    console.log('  - Module type:', typeof Module);
    console.log('  - Module.asm:', !!Module.asm);
    
    // Check for asm exports
    if (Module.asm && typeof Module.asm === 'object') {
        console.log('  - asm keys:', Object.keys(Module.asm));
        console.log('  - asm functions:', Object.keys(Module.asm).filter(k => typeof Module.asm[k] === 'function'));
    }
    
    // Check for wasmExports
    if (Module.wasmExports) {
        console.log('  - wasmExports keys:', Object.keys(Module.wasmExports));
    }
    
    // Check for other common export locations
    if (Module.exports) {
        console.log('  - exports keys:', Object.keys(Module.exports));
    }
    
    // Try to find functions in different locations
    const possibleLocations = [Module, Module.asm, Module.wasmExports, Module.exports];
    possibleLocations.forEach((location, index) => {
        if (location && typeof location === 'object') {
            const locationName = ['Module', 'Module.asm', 'Module.wasmExports', 'Module.exports'][index];
            const funcs = Object.keys(location).filter(k => k.startsWith('_') && typeof location[k] === 'function');
            if (funcs.length > 0) {
                console.log(`  - Functions in ${locationName}:`, funcs.slice(0, 10)); // Show first 10
                // Look specifically for our functions
                const ourFunctions = funcs.filter(k => k.includes('get') || k.includes('test'));
                if (ourFunctions.length > 0) {
                    console.log(`  - Our functions in ${locationName}:`, ourFunctions);
                }
            }
        }
    });
    
    // With EXPORT_ALL=1, check if functions are available directly on Module
    const directFunctions = ['_test', '_get', '_getPlanets', '_getHouses'];
    directFunctions.forEach(fn => {
        if (typeof Module[fn] === 'function') {
            console.log(`  ✅ Found ${fn} directly on Module`);
        }
    });
    
    // Try to manually assign functions if they exist in asm
    if (Module.asm && Module.asm._get && !Module._get) {
        console.log('🔧 Manually assigning functions from asm to Module...');
        Object.keys(Module.asm).forEach(key => {
            if (key.startsWith('_') && typeof Module.asm[key] === 'function') {
                Module[key] = Module.asm[key];
                console.log(`  - Assigned ${key}`);
            }
        });
    }
    
    // If ccall is available, try to test a function call directly
    if (Module.ccall) {
        console.log('🧪 Testing direct ccall availability...');
        try {
            // Since ccall is available, the module should be ready
            // The onRuntimeInitialized callback might not be called in single-file builds
            console.log('  - ccall is available, forcing module ready state');
            console.log('✅ Module is ready! ccall is available for direct function calls.');
            isReady = true;
            clearTimeout(initTimeout);
            
            if (pendingData) {
                console.log('Processing pending data...');
                processData(pendingData);
                pendingData = null;
            }
            return true;
        } catch (error) {
            console.log('  - ccall test failed:', error.message);
        }
    }
    
    return false;
}

// Make Module available globally for the WASM script
self.Module = Module;

console.log('🔄 Loading WASM module...');

// Set up a timeout to detect if initialization fails
var initTimeout = setTimeout(function() {
    if (!isReady) {
        console.error('❌ WASM module initialization timeout after 15 seconds');
        console.error('Module state:', {
            module: !!Module,
            ccall: !!Module.ccall,
            ready: isReady,
            get: !!Module._get
        });
        
        // Try one more time to check if functions became available
        if (!checkModuleReady()) {
            console.error('❌ Functions still not available after timeout');
            if (pendingData) {
                postMessage(JSON.stringify({
                    error: true,
                    error_msg: 'WASM module failed to initialize within 15 seconds'
                }));
            }
        }
    }
}, 15000);

// Add error handling for script loading
try {
    // Import the WASM script - it will use the Module object we defined above
    importScripts('astro-embedded.js');
    console.log('📜 WASM script imported, waiting for initialization...');
    
    // Additional check - sometimes the module is ready immediately
    setTimeout(function() {
        console.log('🔍 Checking module state after 1 second...');
        console.log('Module.ccall available:', !!Module.ccall);
        console.log('isReady flag:', isReady);
        console.log('🔍 All Module properties (first 20):', Object.keys(Module).slice(0, 20));
        console.log('🔍 Module properties count:', Object.keys(Module).length);
        
        // Check for WASM-related properties
        console.log('🔍 WASM properties:', {
            wasmBinary: !!Module.wasmBinary,
            wasmMemory: !!Module.wasmMemory,
            buffer: !!Module.buffer,
            HEAP8: !!Module.HEAP8,
            ready: !!Module.ready
        });
        
        // Try to check if module is ready
        if (!isReady) {
            checkModuleReady();
        }
    }, 1000);
    
    // Additional delayed check
    setTimeout(function() {
        console.log('🔍 Delayed check after 3 seconds...');
        if (!isReady) {
            console.log('🔍 Available functions:', Object.keys(Module).filter(k => k.startsWith('_')));
            checkModuleReady();
        }
    }, 3000);
    
} catch (error) {
    console.error('❌ Failed to import WASM script:', error);
    console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
    });
    postMessage(JSON.stringify({
        error: true,
        error_msg: 'Failed to load WASM script: ' + error.message
    }));
}

// Handle messages from the main thread
self.onmessage = function(event) {
    console.log('📨 Worker received data:', event.data);
    
    if (isReady) {
        console.log('✅ Module ready, processing immediately...');
        clearTimeout(initTimeout);
        processData(event.data);
    } else {
        console.log('⏳ Module not ready, storing data for later...');
        pendingData = event.data;
        
        // Log how long we've been waiting
        var waitTime = Date.now() - initStartTime;
        console.log('⏰ Waiting time so far:', waitTime + 'ms');
        
        // Try a quick check to see if functions became available
        if (Module.ccall && Module._get && !isReady) {
            console.log('🔄 Functions appeared to be available, checking...');
            checkModuleReady();
        }
    }
};

// Function to process the calculation data
function processData(data) {
    try {
        console.log('🔄 Starting calculations...');
        
        // Verify Module and functions are available
        if (!Module || typeof Module._get !== 'function') {
            throw new Error('Module functions are not available');
        }
        
        console.log('🔍 Using direct function calls (ccall has issues with this build)');
        
        // Test function first to verify exports work
        try {
            if (typeof Module._test === 'function') {
                const testResult = Module._test();
                console.log('✅ Test function result:', testResult);
            }
        } catch (error) {
            console.log('❌ Test function failed:', error.message);
        }
        
        // Direct function call for main calculation
        let result;
        try {
            console.log('📍 Calling main calculation function...');
            const resultPtr = Module._get(data[0], data[1], data[2], data[3], data[4], data[5], data[6], data[7], data[8], data[9], data[10], data[11], data[12], data[13], data[14]);
            result = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
            console.log('✅ Main calculation successful');
        } catch (error) {
            throw new Error('Main calculation failed: ' + error.message);
        }
        
        var mainResult = JSON.parse(result);
        console.log('🌍 Main calculation complete:', mainResult);
        
        // Check for additional calculations
        var calculateNodes = data[15] || false;
        var nodeMethod = data[16] || 0;
        var asteroidData = data[17] || null;
        
        console.log('🔍 Calculation parameters:', {
            calculateNodes: calculateNodes,
            nodeMethod: nodeMethod,
            asteroidData: asteroidData
        });
        
        // Calculate nodes if requested
        if (calculateNodes) {
            console.log('🔗 Calculating planetary nodes...');
            try {
                if (typeof Module._getPlanetaryNodes === 'function') {
                    const resultPtr = Module._getPlanetaryNodes(data[0], data[1], data[2], data[3], data[4], data[5], nodeMethod, 50000);
                    const nodesResultDirect = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
                    mainResult.nodes = JSON.parse(nodesResultDirect);
                    console.log('✅ Nodes calculated successfully');
                } else {
                    throw new Error('getPlanetaryNodes function not available');
                }
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
            console.log('🔍 Asteroid data:', asteroidData);
            try {
                var asteroidsResult;
                
                if (asteroidData.mode === 'range') {
                    if (typeof Module._getAsteroids === 'function') {
                        console.log('📍 Calling getAsteroids for range:', asteroidData.start, '-', asteroidData.end);
                        const resultPtr = Module._getAsteroids(data[0], data[1], data[2], data[3], data[4], data[5], asteroidData.start, asteroidData.end, 100000);
                        asteroidsResult = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
                    }
                } else if (asteroidData.mode === 'specific') {
                    if (typeof Module._getSpecificAsteroids === 'function') {
                        console.log('📍 Calling getSpecificAsteroids for list:', asteroidData.list);
                        
                        // Allocate string in WASM memory for C function
                        const listStr = asteroidData.list;
                        const strLen = Module.lengthBytesUTF8(listStr) + 1;
                        const strPtr = Module._malloc(strLen);
                        Module.stringToUTF8(listStr, strPtr, strLen);
                        
                        try {
                            const resultPtr = Module._getSpecificAsteroids(data[0], data[1], data[2], data[3], data[4], data[5], strPtr, 100000);
                            asteroidsResult = typeof resultPtr === 'number' ? Module.UTF8ToString(resultPtr) : resultPtr;
                        } finally {
                            // Always free the allocated string memory
                            Module._free(strPtr);
                        }
                    }
                }
                
                if (asteroidsResult) {
                    console.log('🔍 Raw asteroid result length:', asteroidsResult.length);
                    mainResult.asteroids = JSON.parse(asteroidsResult);
                    console.log('✅ Asteroids calculated successfully:', mainResult.asteroids.summary || 'No summary');
                } else {
                    console.log('❌ No asteroid result returned');
                }
            } catch (error) {
                console.error('❌ Error calculating asteroids:', error);
                mainResult.asteroids = {
                    error: true,
                    error_msg: 'Failed to calculate asteroids: ' + error.message
                };
            }
        }
        
        console.log('🎉 All calculations complete, sending results...');
        postMessage(JSON.stringify(mainResult));
        
    } catch (error) {
        console.error('❌ Fatal error in processData:', error);
        postMessage(JSON.stringify({
            error: true,
            error_msg: 'Calculation failed: ' + error.message
        }));
    }
}
