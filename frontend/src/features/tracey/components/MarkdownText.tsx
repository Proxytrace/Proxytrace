import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownComponents } from './markdown-components';

/**
 * Renders assistant message text as Markdown, themed with DESIGN.md tokens. Element overrides keep
 * the output inside the visual system (no library default styles leak in). `smooth` fades streamed
 * tokens in as they arrive; GFM adds tables + strikethrough + autolinks.
 */
export function MarkdownText() {
  return (
    <MarkdownTextPrimitive
      smooth
      remarkPlugins={[remarkGfm]}
      className="text-[13px] leading-relaxed text-primary"
      components={markdownComponents}
    />
  );
}
