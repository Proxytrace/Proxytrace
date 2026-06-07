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

const HTML_VIEW_TAGS = [
  'p', 'br', 'span', 'div', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'sub', 'sup', 'small',
  'code', 'pre', 'blockquote',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const HTML_VIEW_ATTR = ['href', 'title', 'align', 'colspan', 'rowspan'];

// Wrapper nodes DOMPurify always reports in `removed` when returning a fragment — not real edits.
const WRAPPER_NODES = ['body', 'html', 'head'];

let htmlElementStripped = false;
let htmlHooksRegistered = false;

function ensureHtmlHooks(): void {
  if (htmlHooksRegistered) return;
  // Element-level strips (scripts, disallowed/comment nodes) surface here, but the wrapper body
  // node is reported too — exclude it so clean input isn't flagged as modified.
  DOMPurify.addHook('uponSanitizeElement', (_node, data) => {
    if (!data.allowedTags[data.tagName] && !WRAPPER_NODES.includes(data.tagName)) {
      htmlElementStripped = true;
    }
  });
  // Harden anchors: external-safe rel + new tab, matching the Markdown renderer's link policy.
  DOMPurify.addHook('afterSanitizeAttributes', node => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
  htmlHooksRegistered = true;
}

/**
 * Sanitizes content for the message-bubble HTML view: keeps formatting tags, strips scripts,
 * event handlers, and dangerous URL schemes. `modified` is true when anything was actually
 * removed, so the UI can warn that the rendered HTML differs from the captured source.
 */
export function sanitizeHtml(html: string): { html: string; modified: boolean } {
  ensureHtmlHooks();
  htmlElementStripped = false;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: HTML_VIEW_TAGS,
    ALLOWED_ATTR: HTML_VIEW_ATTR,
  });
  // Attribute strips (event handlers, dangerous schemes) land in `removed`; element strips are
  // tracked via the hook. Ignore the always-present wrapper element so clean input reads false.
  const removedReal = DOMPurify.removed.some(entry => {
    if ('attribute' in entry && entry.attribute) return true;
    const nodeName = 'element' in entry ? entry.element?.nodeName?.toLowerCase() : undefined;
    return nodeName !== undefined && !WRAPPER_NODES.includes(nodeName);
  });
  return { html: clean, modified: htmlElementStripped || removedReal };
}
