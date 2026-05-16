const express = require('express');
const cors = require('cors');
const settings = require('./config/settings');
const { scrapeAllPlatforms } = require('./scrapers/index');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/scrape', async (req, res) => {
  try {
    const { companyName, accounts } = req.body;
    
    if (!companyName || !accounts) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyName and accounts are required' 
      });
    }
    
    console.log(`\n=== Received scrape request for: ${companyName} ===`);
    console.log('Accounts:', JSON.stringify(accounts, null, 2));
    
    const result = await scrapeAllPlatforms(accounts, companyName);
    
    res.json(result);
    
  } catch (error) {
    console.error('Scrape error:', error.message);
    res.status(500).json({ 
      error: 'Scraping failed', 
      message: error.message 
    });
  }
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = settings.serverPort;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║         MetaTry Scraper Server Started           ║
╠═══════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}         ║
║  Health check:     GET  /health                   ║
║  Scrape endpoint:  POST /scrape                   ║
╚═══════════════════════════════════════════════════╝

Input format:
{
  "companyName": "IBM",
  "accounts": {
    "instagram": "https://www.instagram.com/ibm",
    "facebook": "https://www.facebook.com/IBM",
    "linkedin": "https://www.linkedin.com/company/ibm"
  }
}
`);
});

module.exports = app;