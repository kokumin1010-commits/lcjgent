CREATE TABLE `ai_review_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`feedbackReceiptType` enum('line_receipt','web_receipt') NOT NULL,
	`aiDecision` enum('not_tiktok','not_delivered','incomplete','other') NOT NULL,
	`feedbackAiRejectionReason` text,
	`humanDecision` enum('approved','rejected') NOT NULL,
	`humanNote` text,
	`aiWasCorrect` boolean NOT NULL,
	`feedbackImageUrl` text,
	`feedbackImageUrls` json,
	`feedbackOcrRawText` text,
	`feedbackTotalAmount` bigint,
	`feedbackStoreName` varchar(255),
	`feedbackOcrConfidence` decimal(5,2),
	`feedbackReviewedBy` int NOT NULL,
	`feedbackCreatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_review_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `line_receipts` ADD `aiRejectionReason` text;--> statement-breakpoint
ALTER TABLE `line_receipts` ADD `aiRejectionCategory` enum('not_tiktok','not_delivered','incomplete','other');--> statement-breakpoint
ALTER TABLE `line_receipts` ADD `isForceSubmitted` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `line_receipts` ADD `forceSubmittedAt` timestamp;