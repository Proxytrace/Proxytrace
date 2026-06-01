import { describe, it, expect } from 'vitest';
import { buildDocsIndex } from './build-docs-index.mjs';
import { slugify } from './slugify.mjs';

const SAMPLE = `---
title: ignored frontmatter
---
# Agents

An **Agent** is a definition with a [link](/guide/x) and \`inline code\`.

## How agents are detected

As traces flow in, Proxytrace extracts the shape.

### Versioning rule

\`\`\`json
{ "dropped": true }
\`\`\`

- bullet one
- bullet two
`;

describe('slugify', () => {
  it('matches VitePress anchors', () => {
    expect(slugify('Fixing a misclassification')).toBe('fixing-a-misclassification');
    expect(slugify('How agents are detected')).toBe('how-agents-are-detected');
    expect(slugify('85 % similar!')).toBe('_85-similar'); // leading digit prefixed with _
  });
});

describe('buildDocsIndex', () => {
  const index = buildDocsIndex([{ relPath: 'guide/agents.md', content: SAMPLE }]);

  it('uses the H1 as page title and the intro as an anchorless section', () => {
    const intro = index.find(s => s.heading === '');
    expect(intro?.pageTitle).toBe('Agents');
    expect(intro?.url).toBe('/docs/guide/agents.html');
  });

  it('deep-links each heading section to its slug', () => {
    const detected = index.find(s => s.heading === 'How agents are detected');
    expect(detected?.url).toBe('/docs/guide/agents.html#how-agents-are-detected');
  });

  it('strips markdown: links become labels, code is dropped', () => {
    const intro = index.find(s => s.heading === '');
    expect(intro?.text).toContain('link');
    expect(intro?.text).toContain('inline code');
    expect(intro?.text).not.toContain('**');
    expect(intro?.text).not.toContain('[link]');
  });

  it('drops fenced code blocks from section text', () => {
    const versioning = index.find(s => s.heading === 'Versioning rule');
    expect(versioning?.text).not.toContain('dropped');
    expect(versioning?.text).toContain('bullet one');
  });

  it('builds keywords without stopwords or 1-char tokens', () => {
    const detected = index.find(s => s.heading === 'How agents are detected');
    expect(detected?.keywords).toContain('proxytrace');
    expect(detected?.keywords).not.toContain('the');
  });
});
