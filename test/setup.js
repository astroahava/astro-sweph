const fs = require('fs');
const path = require('path');

// Copy the built files to test directory
const distDir = path.join(__dirname, '..', 'dist');
const testDistDir = path.join(__dirname, 'dist');

// Create test dist directory
if (!fs.existsSync(testDistDir)) {
    fs.mkdirSync(testDistDir);
}

// Copy files
const filesToCopy = ['index.js', 'index.d.ts', 'astro.js', 'astro.wasm', 'astro.data'];

filesToCopy.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(testDistDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${file}`);
    } else {
        console.warn(`File not found: ${file}`);
    }
});

console.log('Setup complete!'); 