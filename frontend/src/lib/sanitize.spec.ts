// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { sanitizeSnippet, sanitizeHtml } from './sanitize';

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

describe('sanitizeHtml', () => {
  it('keeps formatting tags and reports no modification', () => {
    const r = sanitizeHtml('<p>hi <strong>there</strong></p>');
    expect(r.html).toContain('<strong>there</strong>');
    expect(r.modified).toBe(false);
  });

  it('hardens anchors with safe rel + target', () => {
    const r = sanitizeHtml('<a href="https://x.dev">link</a>');
    expect(r.html).toContain('href="https://x.dev"');
    expect(r.html).toContain('rel="noopener noreferrer"');
    expect(r.html).toContain('target="_blank"');
  });

  it('strips <script> and flags the content as modified', () => {
    const r = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(r.html).not.toContain('script');
    expect(r.modified).toBe(true);
  });

  it('strips event-handler attributes and dangerous schemes', () => {
    const r = sanitizeHtml('<a href="javascript:alert(1)" onclick="evil()">x</a>');
    expect(r.html).not.toContain('javascript:');
    expect(r.html).not.toContain('onclick');
    expect(r.modified).toBe(true);
  });
});
