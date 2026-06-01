import { slugify } from './slugify.mjs';

// Words ignored when building the keyword set — too common to help ranking.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'are', 'be', 'on', 'for',
  'with', 'as', 'by', 'it', 'its', 'this', 'that', 'these', 'those', 'from', 'at',
  'you', 'your', 'can', 'will', 'into', 'when', 'each', 'per', 'via', 'has', 'have',
]);

/**
 * Strip markdown syntax down to readable plaintext: drops fenced code, turns links
 * into their label, removes emphasis/list/blockquote markers, collapses whitespace.
 * @param {string} md
 * @returns {string}
 */
function stripMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links -> label
    .replace(/^\s{0,3}>+\s?/gm, '')            // blockquote markers
    .replace(/^\s*[-*+]\s+/gm, '')             // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')             // ordered list markers
    .replace(/[*_~]+/g, '')                    // emphasis / strikethrough
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim();
}

/**
 * Tokenize text into a deduped, lowercased keyword list (stopwords + 1-char tokens dropped).
 * @param {string} text
 * @returns {string[]}
 */
function keywordsOf(text) {
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const seen = new Set();
  for (const t of tokens) {
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    seen.add(t);
  }
  return [...seen];
}

/**
 * Derive the served /docs URL from a manual-relative path, e.g. "guide/agents.md"
 * -> "/docs/guide/agents.html". VitePress emits .html (cleanUrls: false).
 * @param {string} relPath
 * @returns {string}
 */
function routeFor(relPath) {
  return `/docs/${relPath.replace(/\.md$/, '.html')}`;
}

/**
 * @typedef {{ relPath: string, content: string }} ManualFile
 * @typedef {{ pageTitle: string, heading: string, url: string, text: string, keywords: string[] }} DocSection
 */

/**
 * Build the searchable docs index from raw manual markdown files. Pure (no fs) so it can
 * be unit-tested with fixtures. Splits each page on ## / ### headings into sections; the
 * intro before the first heading becomes a section with no anchor.
 * @param {ManualFile[]} files
 * @returns {DocSection[]}
 */
export function buildDocsIndex(files) {
  /** @type {DocSection[]} */
  const sections = [];

  for (const { relPath, content } of files) {
    const route = routeFor(relPath);
    // Strip YAML frontmatter if present.
    const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    const lines = body.split('\n');

    let pageTitle = '';
    /** @type {{ heading: string, anchor: string, lines: string[] }} */
    let current = { heading: '', anchor: '', lines: [] };
    const raw = [];

    const flush = () => {
      const text = stripMarkdown(current.lines.join('\n'));
      if (text) raw.push({ heading: current.heading, anchor: current.anchor, text });
    };

    for (const line of lines) {
      const h1 = /^#\s+(.*)$/.exec(line);
      const h = /^(##{1,2})\s+(.*)$/.exec(line); // ## or ###
      if (h1) {
        if (!pageTitle) pageTitle = h1[1].trim();
        continue; // H1 is the page title, not a section divider
      }
      if (h) {
        flush();
        const heading = h[2].trim();
        current = { heading, anchor: slugify(heading), lines: [] };
        continue;
      }
      current.lines.push(line);
    }
    flush();

    const title = pageTitle || relPath;
    for (const s of raw) {
      sections.push({
        pageTitle: title,
        heading: s.heading,
        url: s.anchor ? `${route}#${s.anchor}` : route,
        text: s.text,
        keywords: keywordsOf(`${title} ${s.heading} ${s.text}`),
      });
    }
  }

  return sections;
}
