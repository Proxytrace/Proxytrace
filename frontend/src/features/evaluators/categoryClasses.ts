import type { TypeCategory } from './evaluatorMeta';

/**
 * Per-category Tailwind class recipes. Category color is a design token
 * (llm → accent, rule/numeric → teal); we express it as static arbitrary-value
 * classes rather than threading a CSS-variable string through props (§5.1).
 *
 * `rule` and `numeric` share the teal token — identical recipes.
 */

/** Foreground text in the category's token color. */
export const categoryText: Record<TypeCategory, string> = {
  llm: 'text-accent',
  rule: 'text-teal',
  numeric: 'text-teal',
};

/** A small solid dot/bar background in the category token color. */
export const categoryBg: Record<TypeCategory, string> = {
  llm: 'bg-accent',
  rule: 'bg-teal',
  numeric: 'bg-teal',
};

/** Tinted (14%) surface used for icon boxes / kind pills. */
export const categoryTint14: Record<TypeCategory, string> = {
  llm: 'bg-[color-mix(in_srgb,var(--accent-primary)_14%,transparent)]',
  rule: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
  numeric: 'bg-[color-mix(in_srgb,var(--teal)_14%,transparent)]',
};

/** Tinted (18%) surface used for edit buttons / variable chips. */
export const categoryTint18: Record<TypeCategory, string> = {
  llm: 'bg-[color-mix(in_srgb,var(--accent-primary)_18%,transparent)]',
  rule: 'bg-[color-mix(in_srgb,var(--teal)_18%,transparent)]',
  numeric: 'bg-[color-mix(in_srgb,var(--teal)_18%,transparent)]',
};

/** Selected-row wash (12%) + inset ring (35%). */
export const categorySelectedRow: Record<TypeCategory, string> = {
  llm: 'bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-primary)_35%,transparent)]',
  rule: 'bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--teal)_35%,transparent)]',
  numeric: 'bg-[color-mix(in_srgb,var(--teal)_12%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--teal)_35%,transparent)]',
};

/** Header gradient wash (12% in top-left corner). */
export const categoryHeaderWash: Record<TypeCategory, string> = {
  llm: 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-primary)_12%,transparent),transparent_60%),var(--bg-card)]',
  rule: 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--teal)_12%,transparent),transparent_60%),var(--bg-card)]',
  numeric: 'bg-[linear-gradient(135deg,color-mix(in_srgb,var(--teal)_12%,transparent),transparent_60%),var(--bg-card)]',
};

/** Variable-highlight wash (22%) for rubric placeholders. */
export const categoryVarHighlight: Record<TypeCategory, string> = {
  llm: 'bg-[color-mix(in_srgb,var(--accent-primary)_22%,transparent)]',
  rule: 'bg-[color-mix(in_srgb,var(--teal)_22%,transparent)]',
  numeric: 'bg-[color-mix(in_srgb,var(--teal)_22%,transparent)]',
};

/** The raw CSS color value for a category — only for runtime consumers (charts). */
export const categoryColorVar: Record<TypeCategory, string> = {
  llm: 'var(--accent-primary)',
  rule: 'var(--teal)',
  numeric: 'var(--teal)',
};
