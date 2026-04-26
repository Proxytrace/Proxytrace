-- Foundation: shared org, user, project, evaluator, and model endpoints referenced by all agent scripts.
-- IDs are fixed so scripts can safely cross-reference them.
-- Uses INSERT OR IGNORE so re-runs after a partial failure are safe.

INSERT OR IGNORE INTO OrganizationEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000001', 'TechShop Demo', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO UserEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000002', 'demo-admin', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ProjectEntity (Id, Name, Organization, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000003', 'Production AI', '00000000-0000-0000-0000-000000000001', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

-- EvaluatorKind: ExactMatch = 0
INSERT OR IGNORE INTO EvaluatorEntity (Id, Kind, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000004', 0, '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

-- ── Model Providers ───────────────────────────────────────────────────────────
-- f0000000-…-0001 = OpenAI, f0000000-…-0002 = Anthropic

INSERT OR IGNORE INTO ModelProviderEntity (Id, Name, Endpoint, ApiKey, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000001', 'OpenAI', 'https://api.openai.com/v1', 'demo-key', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ModelProviderEntity (Id, Name, Endpoint, ApiKey, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000002', 'Anthropic', 'https://api.anthropic.com/v1', 'demo-key', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

-- ── Models ────────────────────────────────────────────────────────────────────
-- f0000000-…-0010 = gpt-4o, f0000000-…-0011 = claude-sonnet-4-6, f0000000-…-0012 = gpt-4o-mini

INSERT OR IGNORE INTO ModelEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000010', 'gpt-4o', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ModelEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000011', 'claude-sonnet-4-6', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ModelEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000012', 'gpt-4o-mini', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

-- ── Model Endpoints ───────────────────────────────────────────────────────────
-- f0000000-…-0020 = gpt-4o@openai, f0000000-…-0021 = claude-sonnet-4-6@anthropic, f0000000-…-0022 = gpt-4o-mini@openai
-- Costs are per-token in USD (approximate public pricing).

INSERT OR IGNORE INTO ModelEndpointEntity (Id, Model, Provider, InputTokenCost, OutputTokenCost, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000020',
        'f0000000-0000-0000-0000-000000000010',
        'f0000000-0000-0000-0000-000000000001',
        0.0000025, 0.000010,
        '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ModelEndpointEntity (Id, Model, Provider, InputTokenCost, OutputTokenCost, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000021',
        'f0000000-0000-0000-0000-000000000011',
        'f0000000-0000-0000-0000-000000000002',
        0.000003, 0.000015,
        '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT OR IGNORE INTO ModelEndpointEntity (Id, Model, Provider, InputTokenCost, OutputTokenCost, CreatedAt, UpdatedAt)
VALUES ('f0000000-0000-0000-0000-000000000022',
        'f0000000-0000-0000-0000-000000000012',
        'f0000000-0000-0000-0000-000000000001',
        0.00000015, 0.0000006,
        '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');
