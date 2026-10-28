#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { galaxies } = require('./src/data.json');

const buildDir = path.join(__dirname, 'build');
const index = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
const description = index.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';

const escape = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

fs.mkdirSync(path.join(buildDir, 'g'), { recursive: true });
galaxies.forEach((galaxy, i) => {
  const meta =
    `<meta property="og:title" content="${escape(`${galaxy.name} - Unnamed Space Idle FleetVault`)}"/>` +
    `<meta property="og:description" content="${escape(description)}"/>`;
  const html = index
    .replace(/<title>[^<]*<\/title>/, `<title>G${i + 1} - Unnamed Space Idle FleetVault</title>`)
    .replace('</head>', `${meta}</head>`);
  fs.writeFileSync(path.join(buildDir, 'g', `${i + 1}.html`), html);
});

console.log(`Wrote ${galaxies.length} galaxy pages to build/g/`);
