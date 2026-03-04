CREATE TABLE `fraud_ring_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ringId` int NOT NULL,
	`receiptId1` int NOT NULL,
	`lineUserId1` varchar(64) NOT NULL,
	`receiptId2` int NOT NULL,
	`lineUserId2` varchar(64) NOT NULL,
	`evidenceType` enum('same_image','same_order') NOT NULL,
	`phashDistance` int,
	`orderNumber` varchar(64),
	`imageUrl1` text,
	`imageUrl2` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_ring_evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fraud_ring_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ringId` int NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`displayName` varchar(255),
	`connectionReason` enum('same_image','same_order','hub') NOT NULL,
	`connectedToMemberId` int,
	`evidenceReceiptId` int,
	`evidenceDetail` text,
	`receiptCount` int DEFAULT 0,
	`totalAmount` bigint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fraud_ring_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fraud_rings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ringLabel` varchar(64) NOT NULL,
	`status` enum('suspected','confirmed','dismissed') NOT NULL DEFAULT 'suspected',
	`memberCount` int NOT NULL DEFAULT 0,
	`receiptCount` int NOT NULL DEFAULT 0,
	`totalFraudAmount` bigint DEFAULT 0,
	`hubLineUserId` varchar(64),
	`hubDisplayName` varchar(255),
	`connectionType` enum('same_image','same_order','mixed') NOT NULL,
	`notes` text,
	`confirmedBy` int,
	`confirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fraud_rings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `image_perceptual_hashes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`imageUrl` text NOT NULL,
	`imageIndex` int NOT NULL DEFAULT 0,
	`phash` varchar(64) NOT NULL,
	`imageWidth` int,
	`imageHeight` int,
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `image_perceptual_hashes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_trust_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineUserId` varchar(64) NOT NULL,
	`trustLevel` int NOT NULL DEFAULT 3,
	`ringMembershipCount` int DEFAULT 0,
	`confirmedFraudCount` int DEFAULT 0,
	`totalApprovedReceipts` int DEFAULT 0,
	`totalRejectedReceipts` int DEFAULT 0,
	`manualOverride` boolean DEFAULT false,
	`overrideBy` int,
	`overrideReason` text,
	`lastCalculatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_trust_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_trust_levels_lineUserId_unique` UNIQUE(`lineUserId`)
);
