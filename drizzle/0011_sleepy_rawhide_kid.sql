CREATE TABLE `report_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(100) NOT NULL,
	`linkedStaffId` int,
	`isActive` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reports` RENAME COLUMN `staffId` TO `reportStaffId`;