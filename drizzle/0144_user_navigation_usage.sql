CREATE TABLE IF NOT EXISTS `user_navigation_usage` (
  `userId` int NOT NULL,
  `menuPath` varchar(255) NOT NULL,
  `clickCount` int unsigned NOT NULL DEFAULT 0,
  `lastClickedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`, `menuPath`),
  KEY `idx_user_navigation_rank` (`userId`, `clickCount`, `lastClickedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
