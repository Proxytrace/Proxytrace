import type { Components } from 'react-markdown';

/** Drops react-markdown's non-DOM `node` prop before spreading onto an HTML element. */
export function clean<T extends object>(props: T): Omit<T, 'node'> {
  const next = { ...props } as Record<string, unknown>;
  delete next.node;
  return next as Omit<T, 'node'>;
}

/**
 * Element overrides that keep react-markdown output inside the DESIGN.md visual system
 * (no library default styles leak in). Shared by the streaming chat renderer
 * ({@link ../../features/tracey/components/MarkdownText}), the static artifact renderer,
 * and the message-bubble Markdown view ({@link ./Markdown}).
 */
export const markdownComponents: Components = {
  p: (props) => <p className="mb-2 last:mb-0" {...clean(props)} />,
  ul: (props) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...clean(props)} />,
  ol: (props) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...clean(props)} />,
  li: (props) => <li className="leading-relaxed" {...clean(props)} />,
  a: (props) => {
    const cleaned = clean(props);
    // Manual citations (/docs/...) get a distinct cyan-tinted tag so sourced answers stand out
    // from ordinary inline links.
    const isCitation = typeof cleaned.href === 'string' && cleaned.href.startsWith('/docs/');
    return (
      <a
        className={
          isCitation
            ? 'mx-0.5 inline rounded-sm bg-accent-subtle px-1.5 py-0.5 font-medium text-accent no-underline transition-colors hover:bg-accent hover:text-accent-ink'
            : 'text-accent underline underline-offset-2 hover:opacity-80'
        }
        target="_blank"
        rel="noopener noreferrer"
        {...cleaned}
      />
    );
  },
  strong: (props) => <strong className="font-semibold text-primary" {...clean(props)} />,
  em: (props) => <em className="italic" {...clean(props)} />,
  h1: (props) => (
    <h1 className="mb-2 mt-3 text-h2 font-semibold text-primary first:mt-0" {...clean(props)} />
  ),
  h2: (props) => (
    <h2 className="mb-2 mt-3 text-title font-semibold text-primary first:mt-0" {...clean(props)} />
  ),
  h3: (props) => (
    <h3 className="mb-1.5 mt-2.5 text-title font-semibold text-primary first:mt-0" {...clean(props)} />
  ),
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-secondary" {...clean(props)} />
  ),
  code: (props) => (
    <code
      className="rounded-sm bg-surface px-1 py-0.5 font-mono text-body text-accent"
      {...clean(props)}
    />
  ),
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg border border-border bg-surface p-3 text-body leading-relaxed text-primary [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-primary"
      {...clean(props)}
    />
  ),
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-body" {...clean(props)} />
    </div>
  ),
  th: (props) => (
    <th
      className="border border-hairline bg-card px-2 py-1 text-left font-semibold text-secondary"
      {...clean(props)}
    />
  ),
  td: (props) => <td className="border border-hairline px-2 py-1 text-primary" {...clean(props)} />,
  hr: (props) => <hr className="my-3 border-hairline" {...clean(props)} />,
};
