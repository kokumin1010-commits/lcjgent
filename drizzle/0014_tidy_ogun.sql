CREATE TABLE `report_followups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`reportStaffId` int NOT NULL,
	`extractedItem` text NOT NULL,
	`category` enum('提案','打ち合わせ','商談','MTG','確認','その他') NOT NULL DEFAULT 'その他',
	`status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`completedNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_followups_id` PRIMARY KEY(`id`)
);
