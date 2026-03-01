import {
  fetchLatest,
  fetchByCategory,
  fetchByAuthor,
  fetchByKeyword,
  fetchArticle,
} from './rss-parser.js';
import data from '../data/categories.json' with { type: 'json' };

function textResponse(text) {
  return {
    content: [{ type: 'text', text }],
  };
}

function jsonResponse(obj) {
  return textResponse(JSON.stringify(obj, null, 2));
}

function formatArticle(item, index) {
  const parts = [`**${index + 1}. ${item.title}**`];
  if (item.author) parts.push(`By: ${item.author}`);
  if (item.pubDate) parts.push(`Published: ${item.pubDate}`);
  if (item.description) parts.push(item.description);
  parts.push(`Link: ${item.link}`);
  if (item.image?.url) parts.push(`Image: ${item.image.url}`);
  return parts.join('\n');
}

function formatArticleList(feed, limit) {
  const items = limit ? feed.items.slice(0, limit) : feed.items;
  if (items.length === 0) {
    return 'No articles found.';
  }
  const header = `# ${feed.title || 'OregonLive.com'}\n_Last updated: ${feed.lastBuildDate || 'Unknown'}_\n_${items.length} article(s)_\n`;
  const articles = items.map((item, i) => formatArticle(item, i)).join('\n\n---\n\n');
  return header + '\n' + articles;
}

export const tools = [
  // ─── NEWS TOOLS ───────────────────────────────────────────────

  {
    name: 'get-latest-news',
    description: 'Get the latest news articles from OregonLive.com / The Oregonian. Returns up to 50 of the most recent articles across all categories.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const feed = await fetchLatest({ size: limit });
      return textResponse(formatArticleList(feed, limit));
    },
  },

  {
    name: 'get-category-news',
    description: 'Get news articles from a specific OregonLive.com category. Available categories: news, sports, weather, business, opinion, entertainment, politics, crime, education, environment, dining, beer, travel, portland.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category slug (e.g., "news", "sports", "weather", "business", "opinion", "entertainment", "politics", "crime", "education", "environment", "dining", "beer", "travel", "portland")',
          enum: Object.keys(data.categories),
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
      required: ['category'],
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const categoryInfo = data.categories[args.category];
      if (!categoryInfo) {
        return textResponse(`Unknown category: "${args.category}". Available categories: ${Object.keys(data.categories).join(', ')}`);
      }
      const feed = await fetchByCategory(categoryInfo.slug, { size: limit });
      return textResponse(formatArticleList(feed, limit));
    },
  },

  {
    name: 'get-sports',
    description: 'Get sports news from OregonLive.com, optionally filtered by team. Available teams: blazers (Trail Blazers), ducks (Oregon Ducks), beavers (Oregon State Beavers), timbers (Portland Timbers), thorns (Portland Thorns).',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'Team slug to filter by (optional). Options: blazers, ducks, beavers, timbers, thorns',
          enum: Object.keys(data.sportsTeams),
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const slug = args.team || 'sports';

      if (args.team && !data.sportsTeams[args.team]) {
        return textResponse(`Unknown team: "${args.team}". Available teams: ${Object.keys(data.sportsTeams).join(', ')}`);
      }

      const feed = await fetchByCategory(slug, { size: limit });
      const teamInfo = args.team ? data.sportsTeams[args.team] : null;
      const title = teamInfo
        ? `${teamInfo.name} (${teamInfo.league}) — OregonLive.com`
        : 'Sports — OregonLive.com';

      feed.title = title;
      return textResponse(formatArticleList(feed, limit));
    },
  },

  {
    name: 'get-weather',
    description: 'Get the latest weather news and forecasts from OregonLive.com for Oregon and the Pacific Northwest.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const feed = await fetchByCategory('weather', { size: limit });
      feed.title = 'Weather — OregonLive.com';
      return textResponse(formatArticleList(feed, limit));
    },
  },

  {
    name: 'search-articles',
    description: 'Search OregonLive.com articles by keyword. Uses the RSS keyword feed to find relevant articles.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Keyword to search for in articles',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
      required: ['keyword'],
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const feed = await fetchByKeyword(args.keyword, { size: limit });
      feed.title = `Search: "${args.keyword}" — OregonLive.com`;
      return textResponse(formatArticleList(feed, limit));
    },
  },

  {
    name: 'get-article',
    description: 'Fetch the full content of a specific OregonLive.com article by its URL. Returns headline, author, publication date, and article body text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL of the OregonLive.com article (e.g., https://www.oregonlive.com/news/2026/03/article-slug.html)',
        },
      },
      required: ['url'],
    },
    handler: async (args) => {
      if (!args.url.includes('oregonlive.com')) {
        return textResponse('Error: URL must be from oregonlive.com');
      }
      const article = await fetchArticle(args.url);
      const parts = [];
      if (article.headline) parts.push(`# ${article.headline}`);
      if (article.author) parts.push(`**By:** ${article.author}`);
      if (article.pubDate) parts.push(`**Published:** ${article.pubDate}`);
      if (article.section) parts.push(`**Section:** ${article.section}`);
      if (article.imageUrl) parts.push(`**Image:** ${article.imageUrl}`);
      if (article.description) parts.push(`\n_${article.description}_`);
      if (article.body) parts.push(`\n${article.body}`);
      else parts.push('\n_Article body could not be extracted. The article may be behind a paywall._');
      parts.push(`\n**Source:** ${args.url}`);
      return textResponse(parts.join('\n'));
    },
  },

  {
    name: 'get-articles-by-author',
    description: 'Get articles written by a specific OregonLive.com / Oregonian author. Pass the author name slug (e.g., "mike-rogoway").',
    inputSchema: {
      type: 'object',
      properties: {
        author: {
          type: 'string',
          description: 'Author name slug (lowercase, hyphenated, e.g., "mike-rogoway", "ted-sickinger")',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of articles to return (1-50, default 10)',
        },
      },
      required: ['author'],
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(args.limit || 10, 1), 50);
      const feed = await fetchByAuthor(args.author, { size: limit });
      feed.title = `Articles by ${args.author} — OregonLive.com`;
      return textResponse(formatArticleList(feed, limit));
    },
  },

  // ─── INFORMATION TOOLS ────────────────────────────────────────

  {
    name: 'list-categories',
    description: 'List all available news categories and sports teams on OregonLive.com that can be queried through this MCP server.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const categories = Object.entries(data.categories).map(
        ([slug, cat]) => `- **${cat.name}** (\`${slug}\`): ${cat.description}`
      );
      const teams = Object.entries(data.sportsTeams).map(
        ([slug, team]) => `- **${team.name}** (\`${slug}\`, ${team.league}): ${team.description}`
      );

      const output = [
        '# OregonLive.com — Available Categories',
        '',
        '## News Categories',
        'Use these slugs with the `get-category-news` tool:',
        ...categories,
        '',
        '## Sports Teams',
        'Use these slugs with the `get-sports` tool\'s `team` parameter:',
        ...teams,
        '',
        `## Publisher Info`,
        `${data.publisher.name}`,
        `${data.publisher.description}`,
        `Website: ${data.publisher.url}`,
      ];

      return textResponse(output.join('\n'));
    },
  },

  {
    name: 'get-server-info',
    description: 'Get information about this MCP server, including version, available tools, and data sources.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      return jsonResponse({
        name: 'the-oregonian-mcp',
        version: '1.0.0',
        description: 'MCP server for OregonLive.com / The Oregonian newspaper',
        publisher: data.publisher,
        dataSource: 'OregonLive.com Arc XP RSS Feeds',
        feedBaseUrl: data.feeds.baseUrl,
        capabilities: {
          latestNews: true,
          categoryFiltering: true,
          sportsTeamFiltering: true,
          weather: true,
          articleSearch: true,
          fullArticleFetch: true,
          authorLookup: true,
          adPlacements: true,
          contextualAds: true,
        },
        categories: Object.keys(data.categories),
        sportsTeams: Object.keys(data.sportsTeams),
      });
    },
  },

  // ─── AD SUPPORT TOOLS ────────────────────────────────────────

  {
    name: 'get-ad-placement',
    description: 'Get ad placement data for a given page or article context. This is a placeholder tool designed to be wired up to a real ad server (e.g., Google Ad Manager, DFP). Returns ad slot configuration and targeting parameters that an ad server would use to serve ads.',
    inputSchema: {
      type: 'object',
      properties: {
        placement: {
          type: 'string',
          description: 'Ad placement location on the page',
          enum: ['banner-top', 'inline-article', 'sidebar', 'footer'],
        },
        category: {
          type: 'string',
          description: 'Content category for targeting (e.g., "news", "sports", "weather")',
        },
        articleUrl: {
          type: 'string',
          description: 'URL of the article for contextual targeting (optional)',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional targeting keywords (optional)',
        },
      },
      required: ['placement'],
    },
    handler: async (args) => {
      // Placeholder ad slot configurations
      const placementConfigs = {
        'banner-top': {
          slotId: 'oregonian-banner-top',
          sizes: [[728, 90], [970, 250], [320, 50]],
          type: 'display',
          priority: 'high',
          viewability: 'above-fold',
        },
        'inline-article': {
          slotId: 'oregonian-inline-article',
          sizes: [[300, 250], [336, 280]],
          type: 'display',
          priority: 'medium',
          viewability: 'in-content',
        },
        'sidebar': {
          slotId: 'oregonian-sidebar',
          sizes: [[300, 250], [300, 600], [160, 600]],
          type: 'display',
          priority: 'medium',
          viewability: 'right-rail',
        },
        'footer': {
          slotId: 'oregonian-footer',
          sizes: [[728, 90], [320, 50]],
          type: 'display',
          priority: 'low',
          viewability: 'below-fold',
        },
      };

      const config = placementConfigs[args.placement];
      if (!config) {
        return textResponse(`Unknown placement: "${args.placement}". Available: ${Object.keys(placementConfigs).join(', ')}`);
      }

      const adSlot = {
        ...config,
        targeting: {
          category: args.category || 'general',
          keywords: args.keywords || [],
          articleUrl: args.articleUrl || null,
          publisher: 'oregonlive',
          region: 'pacific-northwest',
        },
        adServer: {
          provider: data.adConfig.provider,
          note: data.adConfig.note,
          // In production, this would include:
          // networkId: 'your-google-ad-manager-network-id',
          // unitPath: '/network-id/oregonlive/placement',
          // endpoint: 'https://securepubads.g.doubleclick.net/...',
        },
        rendered: false,
        placeholderAd: {
          headline: `Support The Oregonian — Oregon's News Since 1850`,
          body: 'Subscribe to OregonLive.com for award-winning local journalism.',
          ctaText: 'Subscribe Now',
          ctaUrl: 'https://www.oregonlive.com/subscribe/',
          type: 'house-ad',
        },
      };

      return jsonResponse(adSlot);
    },
  },

  {
    name: 'get-contextual-ads',
    description: 'Generate contextual ad suggestions based on article content, category, or keywords. Returns relevant ad categories, suggested advertiser types, and targeting recommendations. Useful for planning ad monetization around specific content.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Content category (e.g., "news", "sports", "weather", "dining", "travel")',
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Keywords from article content for contextual matching',
        },
        articleTitle: {
          type: 'string',
          description: 'Article headline for contextual analysis (optional)',
        },
      },
      required: ['category'],
    },
    handler: async (args) => {
      const categoryAdMap = {
        news: {
          adCategories: ['Local Services', 'Legal', 'Government', 'Insurance', 'Financial Services'],
          suggestedAdvertisers: ['Law firms', 'Insurance agencies', 'Local government services', 'Nonprofits', 'Financial advisors'],
          cpmRange: '$8-15',
          audienceProfile: 'Informed adults 25-65, civic-minded, homeowners',
        },
        sports: {
          adCategories: ['Sports Apparel', 'Ticketing', 'Automotive', 'Beverages', 'Streaming Services'],
          suggestedAdvertisers: ['Nike', 'Sports bars', 'Auto dealerships', 'Beer brands', 'Streaming platforms'],
          cpmRange: '$10-20',
          audienceProfile: 'Sports fans 18-54, male-skewing, active lifestyle',
        },
        weather: {
          adCategories: ['Outdoor Gear', 'Home Improvement', 'Automotive', 'Travel', 'Insurance'],
          suggestedAdvertisers: ['REI', 'Home Depot', 'Auto shops', 'Airlines', 'Home insurance'],
          cpmRange: '$6-12',
          audienceProfile: 'Broad audience, commuters, outdoor enthusiasts, homeowners',
        },
        business: {
          adCategories: ['Financial Services', 'Business Software', 'Commercial Real Estate', 'Professional Services'],
          suggestedAdvertisers: ['Banks', 'SaaS companies', 'Commercial realtors', 'Accounting firms', 'Consulting agencies'],
          cpmRange: '$12-25',
          audienceProfile: 'Business professionals 30-60, decision makers, high income',
        },
        opinion: {
          adCategories: ['Publishing', 'Education', 'Nonprofits', 'Political', 'Subscription Services'],
          suggestedAdvertisers: ['Book publishers', 'Universities', 'Think tanks', 'Advocacy organizations'],
          cpmRange: '$8-15',
          audienceProfile: 'Highly engaged readers 35-70, opinion leaders, educated',
        },
        entertainment: {
          adCategories: ['Streaming', 'Events', 'Dining', 'Retail', 'Arts & Culture'],
          suggestedAdvertisers: ['Netflix/streaming', 'Concert venues', 'Restaurants', 'Retailers', 'Museums'],
          cpmRange: '$8-18',
          audienceProfile: 'Culture consumers 21-50, urban, disposable income',
        },
        dining: {
          adCategories: ['Restaurants', 'Food Delivery', 'Kitchen Appliances', 'Wine & Spirits', 'Grocery'],
          suggestedAdvertisers: ['Local restaurants', 'DoorDash/UberEats', 'Kitchen brands', 'Wineries', 'Grocery chains'],
          cpmRange: '$10-20',
          audienceProfile: 'Foodies 25-55, higher income, Portland metro',
        },
        beer: {
          adCategories: ['Craft Beverages', 'Breweries', 'Events', 'Outdoor Recreation', 'Food'],
          suggestedAdvertisers: ['Local breweries', 'Beer festivals', 'Outdoor brands', 'Gastropubs'],
          cpmRange: '$10-18',
          audienceProfile: 'Craft beer enthusiasts 21-45, Portland culture, social',
        },
        travel: {
          adCategories: ['Airlines', 'Hotels', 'Tourism', 'Outdoor Gear', 'Rental Cars'],
          suggestedAdvertisers: ['Alaska Airlines', 'Hotels', 'Travel Oregon', 'REI', 'Rental agencies'],
          cpmRange: '$12-22',
          audienceProfile: 'Travelers 28-60, higher income, adventure seekers',
        },
        politics: {
          adCategories: ['Government', 'Legal', 'Education', 'Nonprofits', 'Media'],
          suggestedAdvertisers: ['Government agencies', 'Law firms', 'Universities', 'Civic orgs'],
          cpmRange: '$8-15',
          audienceProfile: 'Politically engaged adults 30-65, voters, community leaders',
        },
        crime: {
          adCategories: ['Security', 'Legal', 'Insurance', 'Home Safety'],
          suggestedAdvertisers: ['Security companies', 'Criminal defense attorneys', 'Insurance providers', 'Smart home brands'],
          cpmRange: '$6-12',
          audienceProfile: 'Community-minded adults 25-65, homeowners, safety-conscious',
        },
        education: {
          adCategories: ['Higher Education', 'EdTech', 'Tutoring', 'School Supplies', 'Childcare'],
          suggestedAdvertisers: ['Colleges', 'Learning platforms', 'Tutoring services', 'Office supply stores'],
          cpmRange: '$8-15',
          audienceProfile: 'Parents 28-50, educators, students, education advocates',
        },
        environment: {
          adCategories: ['Clean Energy', 'Outdoor Recreation', 'Sustainable Products', 'Automotive (EV)'],
          suggestedAdvertisers: ['Solar companies', 'EV manufacturers', 'Sustainable brands', 'Conservation orgs'],
          cpmRange: '$10-18',
          audienceProfile: 'Environmentally conscious 25-55, Pacific Northwest lifestyle',
        },
        portland: {
          adCategories: ['Local Business', 'Real Estate', 'Dining', 'Events', 'Transportation'],
          suggestedAdvertisers: ['Local businesses', 'Portland realtors', 'Restaurants', 'TriMet', 'Event venues'],
          cpmRange: '$8-15',
          audienceProfile: 'Portland metro residents, all ages, local community focused',
        },
      };

      const category = args.category.toLowerCase();
      const adInfo = categoryAdMap[category] || categoryAdMap['news'];
      const keywords = args.keywords || [];

      const result = {
        category: args.category,
        articleTitle: args.articleTitle || null,
        contextualMatch: {
          primaryCategory: category,
          targetingKeywords: [...new Set([category, ...keywords])],
          ...adInfo,
        },
        recommendations: {
          placements: data.adConfig.defaultPlacements,
          strategy: `For ${category} content, prioritize ${adInfo.adCategories.slice(0, 2).join(' and ')} advertisers. Target ${adInfo.audienceProfile}. Expected CPM range: ${adInfo.cpmRange}.`,
          brandSafety: category === 'crime'
            ? 'CAUTION: Crime content may require enhanced brand safety filtering. Some advertisers exclude crime/violence content.'
            : 'Standard brand safety — suitable for most advertisers.',
        },
        note: 'These are contextual suggestions. For live ad serving, integrate with Google Ad Manager or your preferred ad platform using the get-ad-placement tool.',
      };

      return jsonResponse(result);
    },
  },
];
