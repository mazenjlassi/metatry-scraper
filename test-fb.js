const http = require('http');

const requestBody = {
  companyName: 'nasa',
  accounts: {
    facebook: 'https://www.facebook.com/NASA',
    instagram: '',
    linkedin: ''
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

console.log('Testing Facebook scraping...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Response:', data); });
});

req.on('error', (err) => { console.error('Error:', err.message); });
req.write(postData);
req.end();