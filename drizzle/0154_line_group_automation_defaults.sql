ALTER TABLE `line_groups`
  MODIFY COLUMN `autoFollowUpEnabled` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE `line_groups`
  ADD COLUMN `autoFollowUpEnabledAt` timestamp NULL AFTER `autoFollowUpMessage`;
--> statement-breakpoint
ALTER TABLE `line_group_settings`
  MODIFY COLUMN `analysisEnabled` boolean NOT NULL DEFAULT true,
  MODIFY COLUMN `proactiveAiEnabled` boolean NOT NULL DEFAULT true;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `line_group_automation_rollouts` (
  `rolloutKey` varchar(100) NOT NULL,
  `activeGroupCount` int NOT NULL DEFAULT 0,
  `settingsRowCount` int NOT NULL DEFAULT 0,
  `appliedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rolloutKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
