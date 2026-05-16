const axios = require('axios');

async function test() {
  try {
    console.log('Testing scraper with NASA...\n');
    
    const response = await axios.post('http://localhost:3000/scrape', {
      companyName: 'NASA',
      accounts: {
        instagram: 'https://www.instagram.com/nasa',
        facebook: 'https://www.facebook.com/NASA',
        linkedin: 'https://www.linkedin.com/company/nasa'
      }
    }, { timeout: 300000 });

    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.config) console.log('URL:', error.config.url);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
}

test();