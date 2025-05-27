const AstroSweph = require('astro-sweph');

async function testNodeJs() {
    console.log('Testing Astro-Sweph in Node.js environment...');
    
    try {
        const astroSweph = new AstroSweph();
        await astroSweph.initialize();
        console.log('✓ AstroSweph initialized successfully');

        const params = {
            year: 2024,
            month: 1,
            day: 15,
            hour: 12,
            minute: 0,
            second: 0,
            lonG: 9,
            lonM: 9,
            lonS: 34,
            lonEW: 'E',
            latG: 45,
            latM: 27,
            latS: 40,
            latNS: 'N',
            houseSystem: 'P'
        };

        const result = astroSweph.calculate(params);
        console.log('✓ Calculation completed');
        console.log('Planets found:', result.planets.length);
        console.log('Houses found:', result.house.length);
        
    } catch (error) {
        console.error('✗ Test failed:', error.message);
    }
}

testNodeJs(); 