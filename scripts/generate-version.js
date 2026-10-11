const fs = require('fs');
const path = require('path');

const version = {
  version: require('../package.json').version,
  build: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || 'local',
};

const outputPath = path.join(__dirname, '..', 'public', 'data', 'version.json');

fs.writeFileSync(outputPath, JSON.stringify(version, null, 2));

console.log(`✅ version.json generated: ${version.version} @ ${version.build}`);