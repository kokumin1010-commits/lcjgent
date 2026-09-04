-- The nullable livestream review column is intentionally upgraded by
-- server/livestreamReviewUpgrade.ts before the application begins listening.
-- That upgrade requires verified pre/post backups and preserves every historical livestream row.
SELECT 'livestream-review-managed-by-verified-startup-upgrade';
