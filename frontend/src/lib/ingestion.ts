/**
 * Helpers for the OpenAI-compatible ingestion proxy URL shown in the UI.
 *
 * The proxy base URL carries the project as its first path segment:
 *   {base}/{project-slug}/openai/v1
 * The slug is derived from the project name and must match the backend's `ToSlug`
 * (Proxytrace.Common.Text.SlugExtensions): lower-cased, non-alphanumeric characters dropped,
 * and runs of whitespace / `-` / `_` collapsed into single hyphens.
 */

/** Derives the URL slug for a project name. Mirrors the backend `ToSlug`. */
export function projectSlug(name: string): string {
  const out: string[] = [];
  let pendingHyphen = false;

  for (const ch of name) {
    if (/\p{L}|\p{N}/u.test(ch)) {
      if (pendingHyphen && out.length > 0) out.push('-');
      pendingHyphen = false;
      out.push(ch.toLowerCase());
    } else if (/\s/.test(ch) || ch === '-' || ch === '_') {
      pendingHyphen = true;
    }
  }

  return out.join('');
}

/** The proxy host clients point at. Configurable for split deployments; defaults to this origin. */
export function proxyBaseUrl(): string {
  const configured = (import.meta.env.VITE_PROXY_BASE_URL as string | undefined)?.trim();
  const base = configured && configured.length > 0 ? configured : window.location.origin;
  return base.replace(/\/+$/, '');
}

/** Full OpenAI base_url a client should target for the given project. */
export function ingestionUrl(projectName: string, base: string = proxyBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/${projectSlug(projectName)}/openai/v1`;
}
