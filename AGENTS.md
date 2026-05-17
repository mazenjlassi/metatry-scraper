# MetaTry Scraper - Agent Notes

## Project Overview
Multi-platform social media scraper (Instagram, Facebook, LinkedIn) triggered by Spring Boot backend.

## Current Status

### Working ✅
- **Instagram**: 7-15 posts (no login required for public pages)
- **Facebook**: Getting 15 posts but 14 are garbage/duplicates (only 1 real post)

### Not Working ❌
- **LinkedIn**: Requires login - disabled until login implementation

## Input/Output

### Input (POST /scrape)
```json
{
  "companyName": "NASA",
  "accounts": {
    "instagram": "https://www.instagram.com/nasa",
    "facebook": "https://www.facebook.com/NASA"
  }
}
```

### Output
```json
{
  "companyName": "NASA",
  "scrapedAt": "2026-05-17T...",
  "results": [
    {
      "platform": "instagram",
      "posts": [...]
    },
    {
      "platform": "facebook", 
      "posts": [...]
    }
  ]
}
```

## Post Model Fields
- postText
- postedAt
- mediaType
- hashtags
- mentions
- url

(Note: likes, comments, shares removed)

## Configuration
- POST_LIMIT = 15 (fixed)
- Port: 3000
- HEADLESS = false (for debugging)

## Current Issues

### Facebook - Filter Not Working
- Uses mobile version (m.facebook.com)
- Gets ~15 posts but most are garbage:
  - "NASA - National Aeronautics and Space Administration" (page header repeated)
  - "Informations de compte oubliées?" (login prompts)
  - Many duplicates
- Only 1 real post: "*Did you know* most stars..."
- Filter logic added in Node.js but not filtering correctly
- Root cause: selectors grabbing wrong elements from start

### LinkedIn
- Requires authentication to view company posts
- Temporarily disabled

## Testing
```bash
# Start server
node src/server.js

# Test Instagram only
node test-scrape.js

# Test Facebook only  
node test-fb.js

# Test all platforms
node test-all.js
```

## Files Modified
- src/scrapers/facebookScraper.js - added mobile version, scrolling, filter logic
- src/scrapers/index.js - removed LinkedIn
- src/config/settings.js - postLimit = 15
- src/models/postModel.js - removed likes/comments/shares

## Last Updated
2026-05-17