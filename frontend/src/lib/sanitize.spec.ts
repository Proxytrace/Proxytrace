// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeSnippet } from './sanitize';

describe('sanitizeSnippet', () => {
  it('keeps allowed <mark> highlight tags', () => {
    expect(sanitizeSnippet('a <mark>hit</mark> b')).toBe('a <mark>hit</mark> b');
  });

  it('strips <script> tags', () => {
    expect(sanitizeSnippet('x<script>alert(1)</script>y')).toBe('xy');
  });

  it('strips event-handler attributes / non-allowlisted tags', () => {
    expect(sanitizeSnippet('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeSnippet('<mark onclick="evil()">h</mark>')).toBe('<mark>h</mark>');
  });

  it('strips other tags but keeps their text content', () => {
    expect(sanitizeSnippet('<b>bold</b> <a href="javascript:alert(1)">link</a>')).toBe(
      'bold link',
    );
  });
});
