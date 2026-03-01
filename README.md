# The Oregonian MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server for [OregonLive.com / The Oregonian](https://www.oregonlive.com) — Oregon's largest newspaper, continuously published since 1850.

Provides tools for fetching news articles, sports coverage, weather, and more via OregonLive.com's RSS feeds, plus ad placement and contextual ad support tools.

Built with [mcp-hatchery](https://www.npmjs.com/package/mcp-hatchery) conventions using the [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk).

## Tools

### News & Content
| Tool | Description |
|------|-------------|
| `get-latest-news` | Latest articles across all categories (up to 50) |
| `get-category-news` | Articles from a specific section (news, sports, weather, business, opinion, entertainment, politics, crime, education, environment, dining, beer, travel, portland) |
| `get-sports` | Sports news with optional team filter (blazers, ducks, beavers, timbers, thorns) |
| `get-weather` | Weather forecasts and climate news for Oregon |
| `search-articles` | Search articles by keyword |
| `get-article` | Fetch full article content from a URL |
| `get-articles-by-author` | Articles by a specific author |

### Information
| Tool | Description |
|------|-------------|
| `list-categories` | List all available categories and sports teams |
| `get-server-info` | Server metadata and capabilities |

### Ad Support
| Tool | Description |
|------|-------------|
| `get-ad-placement` | Ad slot configuration for a given placement (banner-top, inline-article, sidebar, footer) — placeholder for wiring to Google Ad Manager or similar |
| `get-contextual-ads` | Contextual ad suggestions based on content category and keywords — returns recommended advertiser types, CPM ranges, and audience profiles |

## Usage

### Claude Desktop / Claude Code

Add to your MCP configuration — no install required:

```json
{
  "mcpServers": {
    "the-oregonian": {
      "command": "npx",
      "args": ["the-oregonian-mcp"]
    }
  }
}
```

### Remote (Netlify)

Deploy to Netlify, then access the MCP endpoint at `https://your-site.netlify.app/api`.

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

## Data Source

All news content is fetched from OregonLive.com's Arc XP RSS feeds:
- Main feed: `https://www.oregonlive.com/arc/outboundfeeds/rss/?outputType=xml`
- Category feeds: `https://www.oregonlive.com/arc/outboundfeeds/rss/category/{slug}/?outputType=xml`
- Author feeds: `https://www.oregonlive.com/arc/outboundfeeds/rss/author/{slug}/?outputType=xml`
- Keyword feeds: `https://www.oregonlive.com/arc/outboundfeeds/rss/keyword/{keyword}/?outputType=xml`

## License

MIT
