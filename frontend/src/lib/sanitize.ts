import DOMPurify from 'dompurify';

/**
 * Sanitize a backend-provided search snippet for use with dangerouslySetInnerHTML.
 *
 * Snippets are built from user/LLM-generated content (agent prompts, traces, test
 * cases) and only ever need the `<mark>` highlight tag. Everything else — scripts,
 * event handlers, other tags, attributes — is stripped to prevent stored XSS.
 */
export function sanitizeSnippet(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  });
}
