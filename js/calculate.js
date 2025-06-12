$(document).ready(function () {
    $("#initDate").val(moment().format("YYYY-MM-DD"));
    $("#initTime").val(moment().format("HH:mm"));

    $("#lonG").val("9");
    $("#lonM").val("9");
    $("#lonS").val("34");
    $("#latG").val("45");
    $("#latM").val("27");
    $("#latS").val("40");

    // Asteroids available in the compressed build (5-50)
    const popularAsteroids = [
        {num: 5, name: "Astraea"},
        {num: 6, name: "Hebe"},
        {num: 7, name: "Iris"},
        {num: 8, name: "Flora"},
        {num: 9, name: "Metis"},
        {num: 10, name: "Hygiea"},
        {num: 11, name: "Parthenope"},
        {num: 12, name: "Victoria"},
        {num: 13, name: "Egeria"},
        {num: 14, name: "Irene"},
        {num: 15, name: "Eunomia"},
        {num: 16, name: "Psyche"},
        {num: 17, name: "Thetis"},
        {num: 18, name: "Melpomene"},
        {num: 19, name: "Fortuna"},
        {num: 20, name: "Massalia"},
        {num: 21, name: "Lutetia"},
        {num: 22, name: "Kalliope"},
        {num: 23, name: "Thalia"},
        {num: 24, name: "Themis"},
        {num: 25, name: "Phocaea"},
        {num: 26, name: "Proserpina"},
        {num: 27, name: "Euterpe"},
        {num: 28, name: "Bellona"},
        {num: 29, name: "Amphitrite"},
        {num: 30, name: "Urania"},
        {num: 31, name: "Euphrosyne"},
        {num: 32, name: "Pomona"},
        {num: 33, name: "Polyhymnia"},
        {num: 34, name: "Circe"},
        {num: 35, name: "Leukothea"},
        {num: 36, name: "Atalante"},
        {num: 37, name: "Fides"},
        {num: 38, name: "Leda"},
        {num: 39, name: "Laetitia"},
        {num: 40, name: "Harmonia"},
        {num: 41, name: "Daphne"},
        {num: 42, name: "Isis"},
        {num: 43, name: "Ariadne"},
        {num: 44, name: "Nysa"},
        {num: 45, name: "Eugenia"},
        {num: 46, name: "Hestia"},
        {num: 47, name: "Aglaja"},
        {num: 48, name: "Doris"},
        {num: 49, name: "Pales"},
        {num: 50, name: "Virginia"}
    ];

    // Initialize popular asteroids display
    initializePopularAsteroids(popularAsteroids);

    // Enable/disable node method based on checkbox
    $("#calculateNodes").on("change", function() {
        $("#nodeMethod").prop("disabled", !this.checked);
    });

    // Show/hide asteroid options
    $("#calculateAsteroids").on("change", function() {
        if (this.checked) {
            $("#asteroidOptions").show();
        } else {
            $("#asteroidOptions").hide();
        }
    });

    // Check asteroid availability when date changes
    $("#initDate").on("change", function() {
        checkAsteroidAvailability();
    });

    function checkAsteroidAvailability() {
        const selectedDate = $("#initDate").val();
        if (selectedDate) {
            const year = moment(selectedDate, "YYYY-MM-DD").year();
            const asteroidCheckbox = $("#calculateAsteroids");
            const asteroidOptions = $("#asteroidOptions");
            
            if (year < 1504) {
                // Disable asteroids for dates before 1504
                asteroidCheckbox.prop("checked", false);
                asteroidCheckbox.prop("disabled", true);
                asteroidOptions.hide();
                
                // Show a warning
                if ($("#asteroidDateWarning").length === 0) {
                    asteroidCheckbox.closest("li").append(
                        '<div id="asteroidDateWarning" class="alert alert-warning alert-sm mt-2" style="font-size: 12px; padding: 8px;">' +
                        '<strong>Note:</strong> Asteroids are not available for dates before 1504. Please select a later date to enable asteroid calculations.' +
                        '</div>'
                    );
                }
            } else {
                // Enable asteroids for dates after 1504
                asteroidCheckbox.prop("disabled", false);
                $("#asteroidDateWarning").remove();
            }
        }
    }

    // Initial check
    checkAsteroidAvailability();

    // Handle asteroid mode changes
    $("input[name='asteroidMode']").on("change", function() {
        const mode = $(this).val();
        $("#popularAsteroidsDiv").toggle(mode === "popular");
        $("#asteroidRangeDiv").toggle(mode === "range");
        $("#asteroidCustomDiv").toggle(mode === "custom");
    });

    // Select/clear all asteroids
    $("#selectAllAsteroids").on("click", function() {
        $(".asteroid-preset").addClass("selected");
    });

    $("#clearAllAsteroids").on("click", function() {
        $(".asteroid-preset").removeClass("selected");
    });

    // Memory management utilities using the new SwissEphemeris class
    window.SwissEphemerisUtils = {
        // Create a calculator instance for testing
        createCalculator: function(options = {}) {
            return new SwissEphemeris({
                workerPath: 'js/sweph-worker.js',
                autoCleanup: true, // Manual control for testing
                memoryOptimized: true,
                ...options
            });
        },
        
        // Check calculator status
        checkStatus: async function() {
            const calculator = this.createCalculator();
            try {
                const status = await calculator.getStatus();
                console.log('🔍 Calculator Status:', status);
                return status;
            } finally {
                calculator.destroy();
            }
        },
        
        // Preload WASM module for faster calculations
        preloadModule: async function() {
            if (window._globalCalculator) {
                console.log('ℹ️ Calculator already exists');
                return;
            }
            
            console.log('🚀 Creating persistent calculator with preloaded module...');
            window._globalCalculator = this.createCalculator({ autoCleanup: false });
            
            try {
                await window._globalCalculator.preload();
                console.log('✅ Global calculator ready with preloaded WASM');
            } catch (error) {
                console.error('❌ Failed to preload:', error);
                window._globalCalculator.destroy();
                delete window._globalCalculator;
            }
        },
        
        // Use the preloaded calculator for calculations
        calculateWithPreloaded: async function(params) {
            if (!window._globalCalculator) {
                throw new Error('No preloaded calculator. Call preloadModule() first.');
            }
            
            return window._globalCalculator.calculateFull(params);
        },
        
        // Unload the global calculator
        unloadGlobalCalculator: function() {
            if (window._globalCalculator) {
                console.log('🗑️ Destroying global calculator...');
                window._globalCalculator.destroy();
                delete window._globalCalculator;
                console.log('✅ Global calculator destroyed');
            } else {
                console.log('ℹ️ No global calculator to destroy');
            }
        },
        
        // Benchmark memory efficiency
        benchmarkMemory: async function() {
            console.log('🏃‍♂️ Starting memory benchmark...');
            
            const testParams = {
                date: '2023-12-25',
                time: '12:00',
                longitude: { degrees: 0, minutes: 0, seconds: 0, direction: 'E' },
                latitude: { degrees: 51, minutes: 30, seconds: 0, direction: 'N' },
                houseSystem: 'P'
            };
            
            // Test 1: Memory-optimized (auto-cleanup)
            console.log('📊 Test 1: Memory-optimized mode');
            const start1 = performance.now();
            const calc1 = this.createCalculator({ autoCleanup: true, memoryOptimized: true });
            await calc1.calculate(testParams);
            const end1 = performance.now();
            console.log(`⏱️ Memory-optimized: ${(end1 - start1).toFixed(2)}ms`);
            
            // Test 2: Speed-optimized (preloaded)
            console.log('📊 Test 2: Speed-optimized mode');
            const calc2 = this.createCalculator({ autoCleanup: false });
            await calc2.preload();
            
            const start2 = performance.now();
            await calc2.calculate(testParams);
            const end2 = performance.now();
            console.log(`⏱️ Speed-optimized: ${(end2 - start2).toFixed(2)}ms`);
            
            calc2.destroy();
            
            console.log('✅ Benchmark complete');
        }
    };
    
    // Add helpful console message
    console.log('🌟 Swiss Ephemeris Class Interface available:');
    console.log('📋 Basic usage:');
    console.log('  const calc = new SwissEphemeris(); await calc.calculate({...})');
    console.log('🔧 Utilities available:');
    console.log('  SwissEphemerisUtils.checkStatus() - Check current status');
    console.log('  SwissEphemerisUtils.preloadModule() - Preload for faster calculations');
    console.log('  SwissEphemerisUtils.calculateWithPreloaded({...}) - Use preloaded instance');
    console.log('  SwissEphemerisUtils.unloadGlobalCalculator() - Free preloaded memory');
    console.log('  SwissEphemerisUtils.benchmarkMemory() - Performance comparison');

    $("#btnCalculate").on("click", function () {
        var jsonError = validateInput();
        if (jsonError.error === true) {
            const toastLiveExample = document.getElementById("liveToast");
            const toast = new bootstrap.Toast(toastLiveExample);
            $("#toastbody").html(jsonError.message);
            toast.show();
            return;
        }

        var iYear, iMonth, iDay, iHour, iMinute, iSecond, iLonG, iLonM, iLonS, sLonEW, iLatG, iLatM, iLatS, sLatNS, sHouse;
        var calculateNodes, nodeMethod, calculateAsteroids, asteroidData;

        var mDate = moment($("#initDate").val(), "YYYY-MM-DD");
        iYear = mDate.year();
        iMonth = mDate.month() + 1;
        iDay = mDate.date();

        var mTime = moment($("#initTime").val(), "HH:mm");
        iHour = mTime.hour();
        iMinute = mTime.minute();
        iSecond = mTime.second();

        iLonG = parseInt($("#lonG").val(), 10);
        iLonM = parseInt($("#lonM").val(), 10);
        iLonS = parseInt($("#lonS").val(), 10);
        sLonEW = $("#lonEW").val();
        iLatG = parseInt($("#latG").val(), 10);
        iLatM = parseInt($("#latM").val(), 10);
        iLatS = parseInt($("#latS").val(), 10);
        sLatNS = $("#latNS").val();

        sHouse = $("#houseSystem").val();
        calculateNodes = $("#calculateNodes").is(":checked");
        nodeMethod = parseInt($("#nodeMethod").val(), 10);
        calculateAsteroids = $("#calculateAsteroids").is(":checked");

        // Prepare asteroid data
        asteroidData = null;
        if (calculateAsteroids) {
            const asteroidMode = $("input[name='asteroidMode']:checked").val();
            if (asteroidMode === "popular") {
                const selectedAsteroids = [];
                $(".asteroid-preset.selected").each(function() {
                    const asteroidNum = $(this).data("asteroid-num");
                    // Validate asteroid is in available range (5-50)
                    if (asteroidNum >= 5 && asteroidNum <= 50) {
                        selectedAsteroids.push(asteroidNum);
                    }
                });
                if (selectedAsteroids.length > 0) {
                    asteroidData = {
                        mode: "specific",
                        list: selectedAsteroids.join(",")
                    };
                }
            } else if (asteroidMode === "range") {
                let start = parseInt($("#asteroidStart").val(), 10);
                let end = parseInt($("#asteroidEnd").val(), 10);
                
                // Validate and constrain to available range (5-50)
                start = Math.max(5, Math.min(50, start));
                end = Math.max(5, Math.min(50, end));
                
                if (start && end && start <= end) {
                    asteroidData = {
                        mode: "range",
                        start: start,
                        end: end
                    };
                }
            } else if (asteroidMode === "custom") {
                const customList = $("#asteroidCustomList").val().trim();
                if (customList) {
                    // Filter to only include asteroids 5-50
                    const asteroidNumbers = customList.split(',')
                        .map(num => parseInt(num.trim(), 10))
                        .filter(num => !isNaN(num) && num >= 5 && num <= 50);
                    
                    if (asteroidNumbers.length > 0) {
                        asteroidData = {
                            mode: "specific",
                            list: asteroidNumbers.join(",")
                        };
                    }
                }
            }
        }

        // Create SwissEphemeris calculator instance
        const calculator = new SwissEphemeris({
            workerPath: 'js/sweph-worker.js',
            autoCleanup: true,
            memoryOptimized: true
        });

        // Prepare calculation parameters in the new format
        const calculationParams = {
            date: $("#initDate").val(),
            time: $("#initTime").val(),
            longitude: {
                degrees: iLonG,
                minutes: iLonM,
                seconds: iLonS,
                direction: sLonEW
            },
            latitude: {
                degrees: iLatG,
                minutes: iLatM,
                seconds: iLatS,
                direction: sLatNS
            },
            houseSystem: sHouse,
            includeNodes: calculateNodes,
            nodeMethod: nodeMethod
        };

        // Add asteroid data if requested
        if (asteroidData) {
            console.log('🔍 Preparing asteroid data:', asteroidData);
            
            // Convert the legacy asteroid data format to the new class format
            if (asteroidData.mode === 'specific') {
                calculationParams.asteroids = {
                    mode: 'specific',
                    selection: asteroidData.list
                };
            } else {
                calculationParams.asteroids = asteroidData;
            }
            
            console.log('🔍 Final asteroid params:', calculationParams.asteroids);
        }

        // Perform calculation using the clean async API
        calculator.calculateFull(calculationParams)
            .then(jsonResult => {
                console.log('🔍 Calculation completed successfully');
                var sResult = createResult(jsonResult);
                $("#resultDiv").html(sResult);
                
                // Cleanup is handled automatically by the class
                calculator.destroy(); // Optional: explicitly destroy for immediate cleanup
            })
            .catch(error => {
                console.error('❌ Calculation failed:', error);
                const toastLiveExample = document.getElementById("liveToast");
                const toast = new bootstrap.Toast(toastLiveExample);
                $("#toastbody").html("Calculation error: " + error.message);
                toast.show();
                
                calculator.destroy(); // Cleanup on error
            });
    });

    function initializePopularAsteroids(asteroids) {
        const container = $("#popularAsteroidsList");
        asteroids.forEach(function(asteroid) {
            const element = $(`<span class="asteroid-preset selected" data-asteroid-num="${asteroid.num}">${asteroid.num} ${asteroid.name}</span>`);
            element.on("click", function() {
                $(this).toggleClass("selected");
            });
            container.append(element);
        });
    }
});

function validateInput() {
    var jsonError = {};
    jsonError.error = false;
    jsonError.message = "";

    // Date
    var bDtValid = moment($("#initDate").val(), "YYYY-MM-DD").isValid();
    if (bDtValid === false) {
        jsonError.error = true;
        jsonError.message = "Invalid date";
        return jsonError;
    } else {
        var dtYear = moment($("#initDate").val(), "YYYY-MM-DD").year();
        if (dtYear < 600 || dtYear > 2400) {
            jsonError.error = true;
            jsonError.message = "Invalid date";
            return jsonError;
        }
    }

    //Time
    var bDtValid = moment($("#initTime").val(), "HH:mm").isValid();
    if (bDtValid === false) {
        jsonError.error = true;
        jsonError.message = "Invalid time";
        return jsonError;
    }

    //Longitude
    var iLonG = parseInt($("#lonG").val(), 10);
    var iLonM = parseInt($("#lonM").val(), 10);
    var iLonS = parseInt($("#lonS").val(), 10);
    if (isNaN(iLonG) === true || iLonG < 0 || iLonG > 179 || isNaN(iLonM) === true || iLonM < 0 || (iLonM > 59) | (isNaN(iLonS) === true) || iLonS < 0 || iLonS > 59) {
        jsonError.error = true;
        jsonError.message = "Invalid longitude";
    }

    // Latitude
    var iLatG = parseInt($("#latG").val(), 10);
    var iLatM = parseInt($("#latM").val(), 10);
    var iLatS = parseInt($("#latS").val(), 10);
    if (isNaN(iLatG) === true || iLatG < 0 || iLatG > 89 || isNaN(iLatM) === true || iLatM < 0 || (iLatM > 59) | (isNaN(iLatS) === true) || iLatS < 0 || iLatS > 59) {
        jsonError.error = true;
        jsonError.message = "Invalid latitude";
    }

    // Asteroid validation
    if ($("#calculateAsteroids").is(":checked")) {
        // Check if date is within asteroid ephemeris range (1504-2400)
        var dtYear = moment($("#initDate").val(), "YYYY-MM-DD").year();
        if (dtYear < 1504) {
            jsonError.error = true;
            jsonError.message = "Asteroids are only available for dates from 1504 onwards (current: " + dtYear + ")";
            return jsonError;
        }

        const asteroidMode = $("input[name='asteroidMode']:checked").val();
        if (asteroidMode === "popular") {
            const selectedCount = $(".asteroid-preset.selected").length;
            if (selectedCount === 0) {
                jsonError.error = true;
                jsonError.message = "Please select at least one asteroid";
                return jsonError;
            }
        } else if (asteroidMode === "range") {
            const start = parseInt($("#asteroidStart").val(), 10);
            const end = parseInt($("#asteroidEnd").val(), 10);
            if (isNaN(start) || isNaN(end) || start < 1 || end > 1000 || start > end) {
                jsonError.error = true;
                jsonError.message = "Invalid asteroid range";
                return jsonError;
            }
        } else if (asteroidMode === "custom") {
            const customList = $("#asteroidCustomList").val().trim();
            if (!customList) {
                jsonError.error = true;
                jsonError.message = "Please enter asteroid numbers";
                return jsonError;
            }
            // Validate custom list format
            const numbers = customList.split(",");
            if (numbers.length > 100) {
                jsonError.error = true;
                jsonError.message = "Too many asteroids (max 100)";
                return jsonError;
            }
            for (let num of numbers) {
                const parsed = parseInt(num.trim(), 10);
                if (isNaN(parsed) || parsed < 1 || parsed > 1000) {
                    jsonError.error = true;
                    jsonError.message = "Invalid asteroid number: " + num.trim();
                    return jsonError;
                }
            }
        }
    }

    return jsonError;
}

function createResult(jsonResult) {
    var sHtml = "";
    
    // Check if we have valid data
    if (!jsonResult || !jsonResult.planets) {
        return "<div class='alert alert-danger'>Error: Invalid calculation result</div>";
    }
    
    // Main planets table
    sHtml = sHtml + "<h5>Planetary Positions</h5>";
    sHtml = sHtml + "<table class='myTable'><thead><tr><th>Planet</th><th>Longitude</th><th>Latitude</th><th>Distance</th><th>Speed</th></tr></thead>";
    sHtml = sHtml + "<tbody>";
    for (var i = 0; i < jsonResult.planets.length; i++) {
        sHtml = sHtml + "<tr>";
        sHtml = sHtml + "<td>" + jsonResult.planets[i].name + "</td>";
        sHtml = sHtml + "<td>" + jsonResult.planets[i].long_s + "</td>";
        sHtml = sHtml + "<td>" + jsonResult.planets[i].lat + "</td>";
        sHtml = sHtml + "<td>" + jsonResult.planets[i].distance + "</td>";
        sHtml = sHtml + "<td>" + jsonResult.planets[i].speed + "</td>";
        sHtml = sHtml + "</tr>";
    }
    sHtml = sHtml + "<tr>";
    sHtml = sHtml + "<td colspan='5'>    </td>";
    sHtml = sHtml + "</tr>";
    sHtml = sHtml + "<tr>";
    sHtml = sHtml + "<td>" + jsonResult.ascmc[0].name + "</td>";
    sHtml = sHtml + "<td>" + jsonResult.ascmc[0].long_s + "</td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "</tr>";
    sHtml = sHtml + "<tr>";
    sHtml = sHtml + "<td>" + jsonResult.ascmc[1].name + "</td>";
    sHtml = sHtml + "<td>" + jsonResult.ascmc[1].long_s + "</td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "<td></td>";
    sHtml = sHtml + "</tr>";
    sHtml = sHtml + "<tr>";
    sHtml = sHtml + "<td colspan='5'>    </td>";
    sHtml = sHtml + "</tr>";

    for (var i = 0; i < jsonResult.houses.length; i++) {
        sHtml = sHtml + "<tr>";
        sHtml = sHtml + "<td>House " + jsonResult.houses[i].name + "</td>";
        sHtml = sHtml + "<td>" + jsonResult.houses[i].long_s + "</td>";
        sHtml = sHtml + "<td></td>";
        sHtml = sHtml + "<td></td>";
        sHtml = sHtml + "<td></td>";
        sHtml = sHtml + "</tr>";
    }
    sHtml = sHtml + "</tbody></table>";

    // Asteroids table (if available)
    if (jsonResult.asteroids && jsonResult.asteroids.asteroids && jsonResult.asteroids.asteroids.length > 0) {
        sHtml = sHtml + "<br><h5>Asteroid Positions</h5>";
        if (jsonResult.asteroids.summary) {
            sHtml = sHtml + "<small class='text-muted'>Calculated: " + jsonResult.asteroids.summary.calculated + 
                    ", Errors: " + jsonResult.asteroids.summary.errors + 
                    " of " + jsonResult.asteroids.summary.total_requested + " requested</small>";
        }
        
        sHtml = sHtml + "<table class='myTable mt-2'><thead><tr><th>Asteroid</th><th>Longitude</th><th>Latitude</th><th>Distance (AU)</th><th>Speed</th></tr></thead>";
        sHtml = sHtml + "<tbody>";
        
        for (var i = 0; i < jsonResult.asteroids.asteroids.length; i++) {
            var asteroid = jsonResult.asteroids.asteroids[i];
            sHtml = sHtml + "<tr>";
            if (asteroid.error) {
                sHtml = sHtml + "<td>" + asteroid.name + " (" + asteroid.index + ")</td>";
                sHtml = sHtml + "<td colspan='4' class='text-danger'>Error: " + (asteroid.error_msg || "Calculation failed") + "</td>";
            } else {
                sHtml = sHtml + "<td>" + asteroid.name + " (" + asteroid.index + ")</td>";
                sHtml = sHtml + "<td>" + asteroid.long_s + "</td>";
                sHtml = sHtml + "<td>" + asteroid.lat.toFixed(4) + "°</td>";
                sHtml = sHtml + "<td>" + asteroid.distance.toFixed(4) + "</td>";
                sHtml = sHtml + "<td>" + asteroid.speed.toFixed(4) + "°/day</td>";
            }
            sHtml = sHtml + "</tr>";
        }
        sHtml = sHtml + "</tbody></table>";
    }

    // Planetary nodes table (if available)
    if (jsonResult.nodes && jsonResult.nodes.nodes && jsonResult.nodes.nodes.length > 0) {
        sHtml = sHtml + "<br><h5>Planetary Nodes & Apsides</h5>";
        sHtml = sHtml + "<small class='text-muted'>Method: " + getNodeMethodName(jsonResult.nodes.method) + "</small>";
        
        // Create tabs for different node types
        sHtml = sHtml + "<ul class='nav nav-tabs mt-2' id='nodesTabs' role='tablist'>";
        sHtml = sHtml + "<li class='nav-item' role='presentation'>";
        sHtml = sHtml + "<button class='nav-link active' id='ascending-tab' data-bs-toggle='tab' data-bs-target='#ascending' type='button' role='tab'>Ascending Nodes</button>";
        sHtml = sHtml + "</li>";
        sHtml = sHtml + "<li class='nav-item' role='presentation'>";
        sHtml = sHtml + "<button class='nav-link' id='descending-tab' data-bs-toggle='tab' data-bs-target='#descending' type='button' role='tab'>Descending Nodes</button>";
        sHtml = sHtml + "</li>";
        sHtml = sHtml + "<li class='nav-item' role='presentation'>";
        sHtml = sHtml + "<button class='nav-link' id='perihelion-tab' data-bs-toggle='tab' data-bs-target='#perihelion' type='button' role='tab'>Perihelion</button>";
        sHtml = sHtml + "</li>";
        sHtml = sHtml + "<li class='nav-item' role='presentation'>";
        sHtml = sHtml + "<button class='nav-link' id='aphelion-tab' data-bs-toggle='tab' data-bs-target='#aphelion' type='button' role='tab'>Aphelion</button>";
        sHtml = sHtml + "</li>";
        sHtml = sHtml + "</ul>";

        sHtml = sHtml + "<div class='tab-content' id='nodesTabContent'>";
        
        // Ascending nodes tab
        sHtml = sHtml + "<div class='tab-pane fade show active' id='ascending' role='tabpanel'>";
        sHtml = sHtml + createNodesTable(jsonResult.nodes.nodes, 'ascending_node');
        sHtml = sHtml + "</div>";

        // Descending nodes tab
        sHtml = sHtml + "<div class='tab-pane fade' id='descending' role='tabpanel'>";
        sHtml = sHtml + createNodesTable(jsonResult.nodes.nodes, 'descending_node');
        sHtml = sHtml + "</div>";

        // Perihelion tab
        sHtml = sHtml + "<div class='tab-pane fade' id='perihelion' role='tabpanel'>";
        sHtml = sHtml + createNodesTable(jsonResult.nodes.nodes, 'perihelion');
        sHtml = sHtml + "</div>";

        // Aphelion tab
        sHtml = sHtml + "<div class='tab-pane fade' id='aphelion' role='tabpanel'>";
        sHtml = sHtml + createNodesTable(jsonResult.nodes.nodes, 'aphelion');
        sHtml = sHtml + "</div>";

        sHtml = sHtml + "</div>";
    }

    return sHtml;
}

function createNodesTable(nodes, nodeType) {
    var sHtml = "";
    sHtml = sHtml + "<table class='myTable mt-2'><thead><tr><th>Planet</th><th>Longitude</th><th>Latitude</th><th>Distance (AU)</th><th>Speed Long</th><th>Speed Lat</th></tr></thead>";
    sHtml = sHtml + "<tbody>";
    
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].error) {
            sHtml = sHtml + "<tr>";
            sHtml = sHtml + "<td>" + nodes[i].name + "</td>";
            sHtml = sHtml + "<td colspan='5' class='text-danger'>Error: " + (nodes[i].error_msg || "Calculation failed") + "</td>";
            sHtml = sHtml + "</tr>";
        } else {
            var nodeData = nodes[i][nodeType];
            sHtml = sHtml + "<tr>";
            sHtml = sHtml + "<td>" + nodes[i].name + "</td>";
            sHtml = sHtml + "<td>" + nodeData.long_s + "</td>";
            sHtml = sHtml + "<td>" + nodeData.lat.toFixed(6) + "°</td>";
            sHtml = sHtml + "<td>" + nodeData.distance.toFixed(6) + "</td>";
            sHtml = sHtml + "<td>" + nodeData.speed_long.toFixed(6) + "°/day</td>";
            sHtml = sHtml + "<td>" + nodeData.speed_lat.toFixed(6) + "°/day</td>";
            sHtml = sHtml + "</tr>";
        }
    }
    sHtml = sHtml + "</tbody></table>";
    return sHtml;
}

function getNodeMethodName(method) {
    switch(method) {
        case 0: return "Mean (Sun-Neptune), Osculating (Pluto+)";
        case 1: return "Osculating (All planets)";
        case 2: return "Barycentric Osculating (Outer planets)";
        case 4: return "Focal Points (instead of aphelia)";
        default: return "Unknown method";
    }
}