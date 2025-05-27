const fs = require('fs');
const path = require('path');

console.log('Setting up local development test...');

// Copy the built files from parent dist to public directory
const distDir = path.join(__dirname, '..', 'dist');
const publicLocalDir = path.join(__dirname, 'public', 'local-package');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
    console.error('❌ dist directory not found. Please run "npm run build" in parent directory first.');
    process.exit(1);
}

// Create public local directory
if (!fs.existsSync(publicLocalDir)) {
    fs.mkdirSync(publicLocalDir, { recursive: true });
}

// Copy files
const requiredFiles = ['index.js', 'index.d.ts', 'astro.js', 'astro.wasm', 'astro.data'];

let allFilesExist = true;
requiredFiles.forEach(file => {
    const srcPath = path.join(distDir, file);
    const destPath = path.join(publicLocalDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        const stats = fs.statSync(srcPath);
        console.log(`✅ Copied ${file} (${Math.round(stats.size / 1024)}KB)`);
    } else {
        console.log(`❌ ${file} - missing`);
        allFilesExist = false;
    }
});

if (allFilesExist) {
    console.log('✅ Local development test setup complete!');
} else {
    console.log('❌ Some files are missing. Run "npm run build" in parent directory first.');
    process.exit(1);
} 