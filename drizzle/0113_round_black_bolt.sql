ALTER TABLE `ai_auto_review_logs` ADD `aiPass` int;--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `reasonCode` varchar(64);--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `beforeStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `afterStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `winnerReceiptId` int;--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `winnerLineUserId` varchar(128);--> statement-breakpoint
ALTER TABLE `ai_auto_review_logs` ADD `phashDistance` int;