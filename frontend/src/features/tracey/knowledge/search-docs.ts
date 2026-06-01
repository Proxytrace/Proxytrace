import type { DocSection, DocSearchHit } from './types';

const MAX_SNIPPET = 240;

/** Lowercased query tokens, stripped of 1-char noise. */
function tokenize(query: string): string[] {
  return (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(t => t.length >= 2);
}

/** Build a short excerpt around the first matched token, else the section start. */
function snippetFor(text: string, tokens: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = at < 0 ? 0 : Math.max(0, at - 60);
  let excerpt = text.slice(start, start + MAX_SNIPPET).trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (start + MAX_SNIPPET < text.length) excerpt = `${excerpt}…`;
  return excerpt;
}

/**
 * Keyword-rank manual sections for a query. Pure and index-agnostic (the index is passed in)
 * so it can be unit-tested with fixtures. A query token scores 3 when it appears in the page
 * title or heading and 1 per occurrence in the body keywords, so on-topic headings win.
 * Returns the top `limit` hits with score > 0, highest first.
 */
export function searchDocs(query: string, index: DocSection[], limit = 4): DocSearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored = index.map(section => {
    const titleHeading = `${section.pageTitle} ${section.heading}`.toLowerCase();
    const bodyKeywords = new Set(section.keywords);
    let score = 0;
    for (const t of tokens) {
      if (titleHeading.includes(t)) score += 3;
      if (bodyKeywords.has(t)) score += 1;
    }
    return { section, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ section }) => ({
      pageTitle: section.pageTitle,
      heading: section.heading,
      url: section.url,
      snippet: snippetFor(section.text, tokens),
    }));
}
