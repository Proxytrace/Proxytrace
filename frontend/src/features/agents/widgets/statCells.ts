/**
 * Shared chrome for the Performance section's two stat groups (totals + distribution). Each metric
 * is its own nested mini-card laid out on a bento grid. `auto-fill` (not `auto-fit`) keeps the cards
 * a uniform width, so a short last row leaves empty track instead of stretching a lone tile across it.
 */
export const STAT_GRID_CLS = 'grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5';
export const STAT_CELL_CLS = 'bg-card-2 rounded-lg p-3 flex flex-col gap-1.5';
