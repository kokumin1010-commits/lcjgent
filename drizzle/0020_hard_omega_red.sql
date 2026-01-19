CREATE TABLE `brand_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`contractType` enum('月額契約','年間契約','単発契約','広告案件','その他') NOT NULL,
	`fixedFee` bigint,
	`commissionRate` varchar(50),
	`startDate` timestamp,
	`endDate` timestamp,
	`status` enum('契約中','完了','保留','終了') NOT NULL DEFAULT '契約中',
	`memo` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brand_contracts_id` PRIMARY KEY(`id`)
);
