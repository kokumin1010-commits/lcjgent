-- The additive LCF admission schema is intentionally upgraded by
-- server/festivalAdmissionService.ts during application startup and before every related API call.
-- The service performs information_schema checks, duplicate-safe DDL and deterministic legacy backfill.
SELECT 'lcf-cumulative-admissions-managed-by-idempotent-startup-upgrade';
