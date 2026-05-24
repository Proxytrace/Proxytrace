import { cn } from '../../../lib/cn';
import type { TypeCategory } from '../evaluatorMeta';
import { categoryText, categoryTint14 } from '../categoryClasses';
import { CategoryIcon } from './evaluatorIcons';

/** Square tinted box holding a category glyph. `size` drives both glyph and box. */
export function TypeIconBox({ category, size = 14 }: { category: TypeCategory; size?: number }) {
  const box = size + 14;
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center shrink-0 rounded-md',
        categoryTint14[category],
        categoryText[category],
      )}
      style={{ width: box, height: box }}
    >
      <CategoryIcon category={category} size={size} />
    </span>
  );
}
