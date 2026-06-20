import type { ApiKeyScope } from '../../api/models';

// ApiKeyScope members and the `/mcp` path are domain identifiers, not translatable UI copy. Keeping
// them in this plain-.ts module (where the lingui lint rule does not apply) keeps the feature's .tsx
// literal-free.
export const SCOPE_ORDER: ApiKeyScope[] = ['Ingestion', 'McpRead', 'McpWrite'];

/** Single-letter mnemonic shown on the capability chip. */
export const SCOPE_LETTER: Record<ApiKeyScope, string> = { Ingestion: 'P', McpRead: 'R', McpWrite: 'W' };

export const hasIngestion = (scopes: ApiKeyScope[]) => scopes.includes('Ingestion');

export const hasMcp = (scopes: ApiKeyScope[]) => scopes.includes('McpRead') || scopes.includes('McpWrite');

export const mcpEndpointUrl = (origin: string) => `${origin}/mcp`;
