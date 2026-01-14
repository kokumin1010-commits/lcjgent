CREATE TABLE `task_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`staffId` int NOT NULL,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_staff_id` PRIMARY KEY(`id`)
);
