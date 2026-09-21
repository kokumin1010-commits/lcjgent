CREATE TABLE IF NOT EXISTS `line_group_automation_states` (
  `lineGroupId` varchar(64) NOT NULL,
  `autoFollowUpEnabledAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`lineGroupId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `line_group_automation_rollouts` (
  `rolloutKey` varchar(100) NOT NULL,
  `activeGroupCount` int NOT NULL DEFAULT 0,
  `settingsRowCount` int NOT NULL DEFAULT 0,
  `appliedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rolloutKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
