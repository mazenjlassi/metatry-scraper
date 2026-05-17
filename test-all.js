const http = require('http');

const requestBody = {
  companyName: 'nasa',
  accounts: {
    instagram: 'https://www.instagram.com/nasa',
    facebook: 'https://www.facebook.com/NASA'
  }
};

const postData = JSON.stringify(requestBody);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/scrape',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('Testing all platforms (Instagram + Facebook)...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { 
    const json = JSON.parse(data);
    console.log('Platforms:', json.results.map(r => `${r.platform}: ${r.posts.length} posts`).join(', '));
  });
});

req.on('error', (err) => { console.error('Error:', err.message); });
req.write(postData);
req.end();