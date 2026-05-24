import { FlaskIcon, FilterIcon, HashIcon } from '../../../components/icons';
import type { TypeCategory } from '../evaluatorMeta';

/** Picks the category glyph for a rail/header icon box. */
export function CategoryIcon({ category, size = 14 }: { category: TypeCategory; size?: number }) {
  if (category === 'llm') return <FlaskIcon size={size} />;
  if (category === 'rule') return <FilterIcon size={size} />;
  return <HashIcon size={size} />;
}
