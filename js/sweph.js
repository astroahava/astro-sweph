self.Module = {
    locateFile: function (s) {
        return s;
    },
    // Add this function
    onRuntimeInitialized: function () {
        var query = get();
        postMessage(query);
    },
};

self.importScripts("astro.js");

self.data = {};

// to pass data from the main JS file
self.onmessage = function (messageEvent) {
    console.log('Worker received:', messageEvent.data); // Debug
    self.data = messageEvent.data; // save the data
};

// gets executed when everything is ready.
self.get = function () {
    try {
        // Call the main calculation function
        var calc = self.Module.ccall(
            "get",
            "string",
            ["number", "number", "number", "number", "number", "number", "number", "number", "number", "string", "number", "number", "number", "string", "string"],
            [self.data[0], self.data[1], self.data[2], self.data[3], self.data[4], self.data[5], self.data[6], self.data[7], self.data[8], self.data[9], self.data[10], self.data[11], self.data[12], self.data[13], self.data[14]]
        );

        var result = JSON.parse(calc);
        console.log('Main result:', result); // Debug

        // Check if nodes calculation is requested (data[15] is calculateNodes, data[16] is nodeMethod)
        var calculateNodes = self.data[15] || false;
        var nodeMethod = self.data[16] || 0;

        if (calculateNodes) {
            console.log('Calculating nodes with method:', nodeMethod); // Debug
            try {
                var nodesResult = self.Module.ccall('getPlanetaryNodes', 'string',
                    ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
                    [self.data[0], self.data[1], self.data[2], self.data[3], self.data[4], self.data[5], nodeMethod, 50000]);
                
                var nodesData = JSON.parse(nodesResult);
                
                // Add nodes data to the main result
                result.nodes = nodesData;
                console.log('Nodes result:', nodesData); // Debug
            } catch (error) {
                console.error('Error calculating planetary nodes:', error);
                // Add empty nodes data with error flag
                result.nodes = {
                    error: true,
                    error_msg: 'Failed to calculate planetary nodes: ' + error.message
                };
            }
        }

        // Check if asteroid calculation is requested (data[17] is asteroidData)
        var asteroidData = self.data[17] || null;

        if (asteroidData) {
            console.log('Calculating asteroids:', asteroidData); // Debug
            try {
                var asteroidsResult;
                
                if (asteroidData.mode === "range") {
                    // Calculate range of asteroids
                    asteroidsResult = self.Module.ccall('getAsteroids', 'string',
                        ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'],
                        [self.data[0], self.data[1], self.data[2], self.data[3], self.data[4], self.data[5], 
                         asteroidData.start, asteroidData.end, 100000]);
                } else if (asteroidData.mode === "specific") {
                    // Calculate specific asteroids from list
                    asteroidsResult = self.Module.ccall('getSpecificAsteroids', 'string',
                        ['number', 'number', 'number', 'number', 'number', 'number', 'string', 'number'],
                        [self.data[0], self.data[1], self.data[2], self.data[3], self.data[4], self.data[5], 
                         asteroidData.list, 100000]);
                }
                
                if (asteroidsResult) {
                    var asteroidsData = JSON.parse(asteroidsResult);
                    
                    // Add asteroids data to the main result
                    result.asteroids = asteroidsData;
                    console.log('Asteroids result:', asteroidsData); // Debug
                }
            } catch (error) {
                console.error('Error calculating asteroids:', error);
                // Add empty asteroids data with error flag
                result.asteroids = {
                    error: true,
                    error_msg: 'Failed to calculate asteroids: ' + error.message
                };
            }
        }

        console.log('Final combined result:', result); // Debug
        return JSON.stringify(result);
    } catch (error) {
        console.error('Error in calculation:', error);
        return JSON.stringify({
            error: true,
            error_msg: 'Calculation failed: ' + error.message
        });
    }
};
