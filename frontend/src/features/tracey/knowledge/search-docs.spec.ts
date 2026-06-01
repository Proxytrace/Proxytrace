import { describe, it, expect } from 'vitest';
import { searchDocs } from './search-docs';
import type { DocSection } from './types';

const INDEX: DocSection[] = [
  {
    pageTitle: 'Proxy Setup',
    heading: 'Point your client at Proxytrace',
    url: '/docs/guide/proxy-setup.html#point-your-client-at-proxytrace',
    text: 'Set the OpenAI base URL to the Proxytrace proxy endpoint and use your issued key.',
    keywords: ['proxy', 'setup', 'point', 'client', 'proxytrace', 'openai', 'base', 'url', 'endpoint', 'key', 'issued'],
  },
  {
    pageTitle: 'Evaluators',
    heading: 'Numeric match',
    url: '/docs/guide/evaluators.html#numeric-match',
    text: 'A numeric-match evaluator compares the numeric answer to the expected value within a tolerance.',
    keywords: ['evaluators', 'numeric', 'match', 'evaluator', 'compares', 'answer', 'expected', 'value', 'tolerance'],
  },
  {
    pageTitle: 'Agents',
    heading: 'How agents are detected',
    url: '/docs/guide/agents.html#how-agents-are-detected',
    text: 'Proxytrace extracts the recurring shape of each agent from captured traces.',
    keywords: ['agents', 'how', 'detected', 'proxytrace', 'extracts', 'recurring', 'shape', 'agent', 'captured', 'traces'],
  },
];

describe('searchDocs', () => {
  it('returns the most relevant section with its deep-link url', () => {
    const hits = searchDocs('how do I set up the proxy', INDEX);
    expect(hits[0].url).toBe('/docs/guide/proxy-setup.html#point-your-client-at-proxytrace');
    expect(hits[0].pageTitle).toBe('Proxy Setup');
  });

  it('ranks a heading/title match above a body-only match', () => {
    const hits = searchDocs('numeric match evaluator', INDEX);
    expect(hits[0].url).toBe('/docs/guide/evaluators.html#numeric-match');
  });

  it('respects the limit', () => {
    const hits = searchDocs('proxytrace', INDEX, 2);
    expect(hits).toHaveLength(2);
  });

  it('returns nothing for an empty or non-matching query', () => {
    expect(searchDocs('', INDEX)).toEqual([]);
    expect(searchDocs('zzz nonexistent term', INDEX)).toEqual([]);
  });

  it('includes a non-empty snippet', () => {
    const hits = searchDocs('numeric tolerance', INDEX);
    expect(hits[0].snippet).toContain('tolerance');
  });
});
