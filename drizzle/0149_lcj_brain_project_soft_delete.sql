ALTER TABLE `lcj_brain_projects`
  ADD COLUMN `deletedAt` DATETIME NULL AFTER `completedAt`;
--> statement-breakpoint
ALTER TABLE `lcj_brain_projects`
  ADD COLUMN `deletedBy` INT NULL AFTER `deletedAt`;
--> statement-breakpoint
ALTER TABLE `lcj_brain_projects`
  ADD COLUMN `deletedByName` VARCHAR(255) NULL AFTER `deletedBy`;
