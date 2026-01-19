CREATE TABLE `brand_lcj_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`reportStaffId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brand_lcj_staff_id` PRIMARY KEY(`id`)
);
