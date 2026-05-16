const fs = require('fs-extra');
const path = require('path');

const outputDir = path.join(__dirname, '../../output');
const outputFile = path.join(outputDir, 'posts.json');

async function saveJson(data) {
  await fs.ensureDir(outputDir);
  await fs.writeJson(outputFile, data, { spaces: 2 });
  return outputFile;
}

module.exports = { saveJson };