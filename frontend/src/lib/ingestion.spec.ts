import { describe, expect, it } from 'vitest';
import { ingestionUrl, projectSlug } from './ingestion';

describe('projectSlug', () => {
  it.each([
    ['Showcase Project', 'showcase-project'],
    ['OpenAI (demo)', 'openai-demo'],
    ['  leading and trailing  ', 'leading-and-trailing'],
    ['Multiple   spaces', 'multiple-spaces'],
    ['already-slugged', 'already-slugged'],
    ['Mixed_Case_Underscores', 'mixed-case-underscores'],
  ])('slugifies %j -> %j', (input, expected) => {
    expect(projectSlug(input)).toBe(expected);
  });
});

describe('ingestionUrl', () => {
  it('builds {base}/{slug}/openai/v1 against an explicit base', () => {
    expect(ingestionUrl('Showcase Project', 'https://host')).toBe(
      'https://host/showcase-project/openai/v1',
    );
  });

  it('trims a trailing slash on the base', () => {
    expect(ingestionUrl('Showcase Project', 'https://host/')).toBe(
      'https://host/showcase-project/openai/v1',
    );
  });
});
