CREATE TABLE IF NOT EXISTS `system_roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500),
  `color` VARCHAR(20) DEFAULT '#6366f1',
  `isSystem` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_role_name` (`name`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `roleId` INT NOT NULL,
  `pageKey` VARCHAR(255) NOT NULL,
  `canView` BOOLEAN NOT NULL DEFAULT TRUE,
  `canEdit` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_role_page` (`roleId`, `pageKey`),
  INDEX `idx_roleId` (`roleId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_role_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `roleId` INT NOT NULL,
  `assignedBy` INT,
  `assignedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_user_role` (`userId`),
  INDEX `idx_roleId` (`roleId`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_management_scopes` (
  `userId` INT NOT NULL PRIMARY KEY,
  `managementLevel` ENUM('employee', 'department_manager') NOT NULL DEFAULT 'employee',
  `managedDepartment` VARCHAR(255),
  `assignedBy` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_management_level` (`managementLevel`),
  INDEX `idx_managed_department` (`managedDepartment`)
);
--> statement-breakpoint
INSERT INTO `system_roles` (`name`, `description`, `color`, `isSystem`)
VALUES ('超级管理员', '全部权限，系统最高权限', '#ef4444', TRUE)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `color` = VALUES(`color`),
  `isSystem` = TRUE;
--> statement-breakpoint
INSERT INTO `user_role_assignments` (`userId`, `roleId`, `assignedBy`)
SELECT `user`.`id`, `role`.`id`, NULL
FROM `users` AS `user`
INNER JOIN `system_roles` AS `role`
  ON `role`.`name` = '超级管理员' AND `role`.`isSystem` = TRUE
WHERE LOWER(TRIM(`user`.`email`)) IN (
  'ryuhairartist@gmail.com',
  'cindy121481@gmail.com'
)
ON DUPLICATE KEY UPDATE
  `roleId` = VALUES(`roleId`),
  `assignedBy` = NULL;
--> statement-breakpoint
UPDATE `users`
SET `role` = 'admin'
WHERE LOWER(TRIM(`email`)) IN (
  'ryuhairartist@gmail.com',
  'cindy121481@gmail.com'
);
--> statement-breakpoint
INSERT IGNORE INTO `user_management_scopes` (`userId`, `managementLevel`)
SELECT `id`, 'employee' FROM `users`;
