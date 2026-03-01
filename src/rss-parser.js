import { XMLParser } from 'fast-xml-parser';

const RSS_BASE = 'https://www.oregonlive.com/arc/outboundfeeds/rss';
const RSS_PARAMS = '?outputType=xml';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '__cdata',
  parseTagValue: true,
  trimValues: true,
});

/**
 * Build a feed URL for a given type and value.
 * Types: 'main', 'category', 'author', 'keyword', 'tag'
 */
export function buildFeedUrl(type, value, options = {}) {
  const { size, from } = options;
  let url;

  switch (type) {
    case 'main':
      url = `${RSS_BASE}/${RSS_PARAMS}`;
      break;
    case 'category':
      url = `${RSS_BASE}/category/${encodeURIComponent(value)}/${RSS_PARAMS}`;
      break;
    case 'author':
      url = `${RSS_BASE}/author/${encodeURIComponent(value)}/${RSS_PARAMS}`;
      break;
    case 'keyword':
      url = `${RSS_BASE}/keyword/${encodeURIComponent(value)}/${RSS_PARAMS}`;
      break;
    case 'tag':
      url = `${RSS_BASE}/tags/${encodeURIComponent(value)}/${RSS_PARAMS}`;
      break;
    default:
      throw new Error(`Unknown feed type: ${type}`);
  }

  if (size) url += `&size=${size}`;
  if (from) url += `&from=${from}`;

  return url;
}

/**
 * Fetch and parse an RSS feed, returning normalized article objects.
 */
export async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TheOregonianMCP/1.0 (MCP News Server)',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const channel = parsed?.rss?.channel;
  if (!channel) {
    return { title: 'Unknown', items: [] };
  }

  const rawItems = channel.item || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).map(normalizeItem);

  return {
    title: extractText(channel.title),
    link: channel.link,
    description: extractText(channel.description),
    lastBuildDate: channel.lastBuildDate,
    items,
  };
}

/**
 * Fetch articles by category slug.
 */
export async function fetchByCategory(category, options = {}) {
  const url = buildFeedUrl('category', category, options);
  return fetchFeed(url);
}

/**
 * Fetch the main (all content) feed.
 */
export async function fetchLatest(options = {}) {
  const url = buildFeedUrl('main', null, options);
  return fetchFeed(url);
}

/**
 * Fetch articles by author slug.
 */
export async function fetchByAuthor(author, options = {}) {
  const url = buildFeedUrl('author', author, options);
  return fetchFeed(url);
}

/**
 * Fetch articles by keyword.
 */
export async function fetchByKeyword(keyword, options = {}) {
  const url = buildFeedUrl('keyword', keyword, options);
  return fetchFeed(url);
}

/**
 * Fetch a single article's content from its URL.
 */
export async function fetchArticle(articleUrl) {
  const response = await fetch(articleUrl, {
    headers: {
      'User-Agent': 'TheOregonianMCP/1.0 (MCP News Server)',
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractArticleContent(html);
}

/**
 * Normalize a raw RSS item into a clean article object.
 */
function normalizeItem(item) {
  const media = item['media:content'];
  const image = media ? {
    url: media['@_url'] || null,
    width: media['@_width'] ? parseInt(media['@_width'], 10) : null,
    height: media['@_height'] ? parseInt(media['@_height'], 10) : null,
    caption: extractText(media['media:description']),
    credit: extractText(media['media:credit']),
  } : null;

  return {
    title: extractText(item.title),
    link: item.link || item.guid?.['#text'] || item.guid,
    author: extractText(item['dc:creator']),
    description: extractText(item.description),
    pubDate: item.pubDate,
    content: stripHtml(extractText(item['content:encoded'])),
    image,
  };
}

/**
 * Extract text from a value that may be CDATA-wrapped or a plain string.
 */
function extractText(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.__cdata || value['#text'] || String(value);
  }
  return String(value);
}

/**
 * Strip HTML tags from a string, keeping just the text content.
 */
function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract article content from raw HTML page.
 * Pulls headline, author, date, and body text from the article page.
 */
function extractArticleContent(html) {
  const headline = extractMeta(html, 'og:title') || extractTagContent(html, 'h1');
  const description = extractMeta(html, 'og:description');
  const author = extractMeta(html, 'article:author') || extractMetaName(html, 'author');
  const pubDate = extractMeta(html, 'article:published_time') || extractMetaName(html, 'publish-date');
  const imageUrl = extractMeta(html, 'og:image');
  const section = extractMeta(html, 'article:section');

  // Extract article body paragraphs
  const bodyParagraphs = [];
  const pRegex = /<p[^>]*class="[^"]*"[^>]*>(.*?)<\/p>/gs;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]);
    if (text && text.length > 20) {
      bodyParagraphs.push(text);
    }
  }

  // Fallback: grab all <p> tags if nothing found with classes
  if (bodyParagraphs.length === 0) {
    const simplePRegex = /<p>(.*?)<\/p>/gs;
    while ((match = simplePRegex.exec(html)) !== null) {
      const text = stripHtml(match[1]);
      if (text && text.length > 20) {
        bodyParagraphs.push(text);
      }
    }
  }

  return {
    headline,
    description,
    author,
    pubDate,
    section,
    imageUrl,
    body: bodyParagraphs.join('\n\n'),
    paragraphCount: bodyParagraphs.length,
  };
}

function extractMeta(html, property) {
  const regex = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i');
  const match = regex.exec(html) || altRegex.exec(html);
  return match ? match[1] : null;
}

function extractMetaName(html, name) {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const altRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i');
  const match = regex.exec(html) || altRegex.exec(html);
  return match ? match[1] : null;
}

function extractTagContent(html, tag) {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is');
  const match = regex.exec(html);
  return match ? stripHtml(match[1]) : null;
}
