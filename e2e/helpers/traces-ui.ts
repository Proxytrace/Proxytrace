import type { Page } from '@playwright/test';

// Interactions with the traces page's composable filter bar ("+ Filter" → field → value).
// Shared by every spec that narrows the traces table, so a filter-bar change lands here once.

/** Adds a filter via the "+ Filter" picker: choose the field, then pick an option by key. */
export async function addTraceFilter(page: Page, field: string, optionKey: string): Promise<void> {
  await page.getByTestId('traces-add-filter').click();
  await page.getByTestId(`traces-filter-field-${field}`).click();
  await page.getByTestId(`traces-filter-option-${optionKey}`).click();
}

/** Narrows the table to one agent (the former toolbar "Agent:" dropdown, now a filter chip). */
export function selectAgentFilter(page: Page, agentId: string): Promise<void> {
  return addTraceFilter(page, 'agent', agentId);
}

/** Opens an active filter chip's editor and removes that filter. */
export async function removeTraceFilter(page: Page, field: string): Promise<void> {
  await page.getByTestId(`traces-filter-chip-${field}`).click();
  await page.getByTestId('traces-filter-remove').click();
}

/**
 * Turns on "System traces" from the "+ Filter" picker. Unlike the value filters it's a boolean
 * view toggle, so it flips on click and surfaces as a removable "System traces" chip.
 */
export async function toggleSystemTraces(page: Page): Promise<void> {
  await page.getByTestId('traces-add-filter').click();
  await page.getByTestId('traces-filter-field-system').click();
}
