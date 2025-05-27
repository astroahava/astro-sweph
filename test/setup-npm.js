const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Setting up npm package test...');

// Create package.json for npm test if it doesn't exist
const testNpmDir = path.join(__dirname, 'npm-test');
if (!fs.existsSync(testNpmDir)) {
    fs.mkdirSync(testNpmDir);
}

const testPackageJson = {
    "name": "astro-sweph-npm-test",
    "version": "1.0.0",
    "private": true,
    "dependencies": {}
};

// Check if we should install from local package or npm registry
const parentDir = path.join(__dirname, '..');
const localPackageJson = path.join(parentDir, 'package.json');

if (fs.existsSync(localPackageJson)) {
    console.log('Installing local package...');
    // Install from local directory
    testPackageJson.dependencies["astro-sweph"] = `file:${parentDir}`;
} else {
    console.log('Installing from npm registry...');
    // Install from npm (replace with your actual package name)
    testPackageJson.dependencies["astro-sweph"] = "latest";
}

// Write package.json
fs.writeFileSync(
    path.join(testNpmDir, 'package.json'), 
    JSON.stringify(testPackageJson, null, 2)
);

// Install dependencies
console.log('Installing dependencies...');
try {
    execSync('npm install', { cwd: testNpmDir, stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
} catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
}

// Copy the installed package files to public directory for serving
const nodeModulesPath = path.join(testNpmDir, 'node_modules', 'astro-sweph');
const publicNpmDir = path.join(__dirname, 'public', 'npm-package');

if (fs.existsSync(nodeModulesPath)) {
    // Create public npm directory
    if (!fs.existsSync(publicNpmDir)) {
        fs.mkdirSync(publicNpmDir, { recursive: true });
    }
    
    // Copy dist files
    const distPath = path.join(nodeModulesPath, 'dist');
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        files.forEach(file => {
            fs.copyFileSync(
                path.join(distPath, file),
                path.join(publicNpmDir, file)
            );
        });
        console.log('✅ Copied npm package files to public directory');
    }
} else {
    console.error('❌ astro-sweph package not found in node_modules');
    process.exit(1);
}

console.log('✅ NPM package test setup complete!');
console.log('Run "npm start" to start the test server'); 