CREATE TABLE IF NOT EXISTS `line_group_ai_draft_audit` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `lineGroupId` varchar(255) NOT NULL,
  `actorKey` varchar(128) NOT NULL,
  `rateBucket` bigint NOT NULL,
  `sourceMessageAt` timestamp NULL,
  `hadExistingDraft` boolean NOT NULL DEFAULT false,
  `status` enum('processing','completed','rejected') NOT NULL DEFAULT 'processing',
  `model` varchar(100) NULL,
  `promptTokens` int NOT NULL DEFAULT 0,
  `completionTokens` int NOT NULL DEFAULT 0,
  `latencyMs` int NOT NULL DEFAULT 0,
  `recommendedProductId` int NULL,
  `errorCode` varchar(160) NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL,
  CONSTRAINT `line_group_ai_draft_audit_id` PRIMARY KEY(`id`),
  CONSTRAINT `uq_line_group_ai_draft_group_bucket` UNIQUE(`lineGroupId`, `rateBucket`),
  CONSTRAINT `uq_line_group_ai_draft_actor_bucket` UNIQUE(`actorKey`, `rateBucket`),
  INDEX `idx_line_group_ai_draft_created` (`createdAt`),
  INDEX `idx_line_group_ai_draft_status` (`status`)
);
--> statement-breakpoint
ALTER TABLE `line_groups`
  ADD COLUMN `conversationRevision` bigint unsigned NOT NULL DEFAULT 0;
