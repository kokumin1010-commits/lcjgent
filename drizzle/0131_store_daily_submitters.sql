-- Store daily submitter schema changes are intentionally executed by
-- server/storeExecutionUpgrade.ts during application startup.
-- That upgrade performs verified pre/post backups, row-count guards,
-- idempotent column/index checks, and a conservative legacy backfill.
SELECT 'store-execution-v2-daily-submitters-managed-by-backup-gated-startup-upgrade';
