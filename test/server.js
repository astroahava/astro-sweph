const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Serve the built npm package files directly from parent dist (for local dev)
app.use('/astro-sweph', express.static(path.join(__dirname, '../dist')));

// Serve local package files
app.use('/local-package', express.static(path.join(__dirname, 'public/local-package')));

// Serve npm package files
app.use('/npm-package', express.static(path.join(__dirname, 'public/npm-package')));

// Serve specific files with correct MIME types
app.get('/astro-sweph/astro.wasm', (req, res) => {
    res.setHeader('Content-Type', 'application/wasm');
    res.sendFile(path.join(__dirname, '../dist/astro.wasm'));
});

app.get('/astro-sweph/astro.data', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(path.join(__dirname, '../dist/astro.data'));
});

// Routes for different test pages
app.get('/', (req, res) => {
    res.send(`
        <h1>Astro-Sweph Test Options</h1>
        <ul>
            <li><a href="/local-dev">Local Development Test</a> - Uses files from parent dist/ directory</li>
            <li><a href="/local-package">Local Package Test</a> - Uses copied package files</li>
            <li><a href="/npm-package">NPM Package Test</a> - Uses installed npm package</li>
        </ul>
    `);
});

app.get('/local-dev', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/local-package', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'local-package-test.html'));
});

app.get('/npm-package', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'npm-package-test.html'));
});

app.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log('Available test pages:');
    console.log('  - http://localhost:3000/local-dev (uses parent dist/ files)');
    console.log('  - http://localhost:3000/local-package (uses copied files)');
    console.log('  - http://localhost:3000/npm-package (uses installed npm package)');
}); 