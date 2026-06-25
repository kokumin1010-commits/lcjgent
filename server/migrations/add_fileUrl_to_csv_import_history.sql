-- Add fileUrl column to csv_import_history table for storing S3 download links
ALTER TABLE csv_import_history ADD COLUMN IF NOT EXISTS fileUrl VARCHAR(500) DEFAULT NULL;
