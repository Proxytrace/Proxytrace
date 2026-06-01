/**
 * One searchable slice of the product manual: a heading-delimited section of a guide/admin
 * page. Produced at build time by `scripts/docs-index/build-docs-index.mjs` and bundled into
 * the frontend so Tracey's `search_docs` tool can answer from the docs with no backend.
 */
export interface DocSection {
  /** Title of the page this section belongs to (its H1). */
  pageTitle: string;
  /** The section heading (`## `/`### `), or '' for the page intro before the first heading. */
  heading: string;
  /** Served /docs URL, deep-linked to the section anchor when there is one. */
  url: string;
  /** Plaintext of the section (markdown stripped). */
  text: string;
  /** Deduped lowercased keyword tokens from title + heading + text, used for ranking. */
  keywords: string[];
}

/** A single manual hit returned by `searchDocs`, shaped for Tracey to cite. */
export interface DocSearchHit {
  pageTitle: string;
  heading: string;
  /** Clickable /docs URL (with anchor) Tracey cites as an inline markdown link. */
  url: string;
  /** Short excerpt of the matched section for context. */
  snippet: string;
}
