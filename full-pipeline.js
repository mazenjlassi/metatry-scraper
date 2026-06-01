const http = require('http');
const settings = require('./src/config/settings');
const { scrapeAllPlatforms } = require('./src/scrapers/index');

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8081';

// Scrape all 3 platforms
const companyName = process.argv[2] || 'Nike';
const ig = process.argv[3] || `https://www.instagram.com/${companyName.toLowerCase()}`;
const fb = process.argv[4] || `https://www.facebook.com/${companyName}`;
const li = process.argv[5] || `https://www.linkedin.com/company/${companyName.toLowerCase()}`;

async function main() {
  console.log(`\n========== FULL PIPELINE: ${companyName} ==========\n`);

  // 1. Scrape
  console.log('▶ Step 1: Scraping all 3 platforms...');
  const result = await scrapeAllPlatforms({ instagram: ig, facebook: fb, linkedin: li }, companyName);
  const total = result.results.reduce((s, r) => s + r.posts.length, 0);
  result.results.forEach(r => console.log(`  ${r.platform}: ${r.posts.length} posts`));
  console.log(`  Total: ${total} posts\n`);

  if (total === 0) {
    console.log('⚠ No posts scraped, skipping backend save');
    process.exit(0);
  }

  // 2. Forward to backend
  console.log('▶ Step 2: Saving to backend database...');
  const backBody = JSON.stringify({
    companyName,
    linkedin: li,
    instagram: ig,
    facebook: fb
  });

  await new Promise((resolve, reject) => {
    const req = http.request(`${BACKEND}/api/scraper/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(backBody) },
      timeout: 180000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`  ✅ Backend saved successfully (${res.statusCode})`);
        } else {
          console.log(`  ❌ Backend error: ${res.statusCode} ${data.slice(0, 200)}`);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log(`  ❌ Backend unreachable: ${e.message}`);
      console.log(`  Is the backend running at ${BACKEND}?`);
      resolve();
    });
    req.write(backBody);
    req.end();
  });

  console.log('\n========== DONE ==========');
  console.log(`Patterns will auto-analyze when 3+ unanalyzed posts exist for ${companyName}`);
  console.log('Check patterns at: GET /api/patterns');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
