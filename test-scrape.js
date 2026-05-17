const http = require('http');

const requestBody = {
  companyName: 'nasa',
  accounts: {
    instagram: 'https://www.instagram.com/nasa'
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

console.log('Sending request to /scrape...');

const req = http.request(options, (res) => {
  console.log('Response status:', res.statusCode);
  console.log('Response headers:', res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response body:', data);
  });
});

req.on('error', (err) => {
  console.error('Error:', err);
});

req.write(postData);
req.end();