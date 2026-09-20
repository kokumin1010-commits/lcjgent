CREATE TABLE IF NOT EXISTS `line_group_settings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `lineGroupId` varchar(255) NOT NULL,
  `autoReplyEnabled` boolean NOT NULL DEFAULT true,
  `autoReplyMessage` text,
  `analysisEnabled` boolean NOT NULL DEFAULT false,
  `proactiveAiEnabled` boolean NOT NULL DEFAULT false,
  `relationshipObjective` text,
  `groupInsightJson` longtext,
  `groupInsightUpdatedAt` timestamp NULL,
  `groupInsightLastMessageAt` timestamp NULL,
  `groupInsightMessageCount` int NOT NULL DEFAULT 0,
  `groupInsightLeaseToken` varchar(64) NULL,
  `groupInsightLeaseExpiresAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `line_group_settings_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_line_group_settings_group` UNIQUE(`lineGroupId`)
);
