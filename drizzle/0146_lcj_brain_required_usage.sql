CREATE TABLE IF NOT EXISTS `lcj_brain_required_usage` (
  `userId` int NOT NULL,
  `questionId` varchar(64) NOT NULL,
  `conversationId` int DEFAULT NULL,
  `evidenceSourceIds` json NOT NULL,
  `completedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`userId`),
  KEY `idx_lcj_brain_required_usage_completed` (`completedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
