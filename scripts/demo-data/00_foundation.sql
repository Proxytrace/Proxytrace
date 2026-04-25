-- Foundation: shared org, user, project, and evaluator referenced by all agent scripts.
-- IDs are fixed so scripts can safely cross-reference them.

INSERT INTO OrganizationEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000001', 'TechShop Demo', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT INTO UserEntity (Id, Name, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000002', 'demo-admin', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

INSERT INTO OrganizationUserEntity (OrganizationId, UserId)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

INSERT INTO ProjectEntity (Id, Name, Organization, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000003', 'Production AI', '00000000-0000-0000-0000-000000000001', '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');

-- EvaluatorKind: ExactMatch = 0
INSERT INTO EvaluatorEntity (Id, Kind, CreatedAt, UpdatedAt)
VALUES ('00000000-0000-0000-0000-000000000004', 0, '2026-03-01T08:00:00.0000000+00:00', '2026-03-01T08:00:00.0000000+00:00');
