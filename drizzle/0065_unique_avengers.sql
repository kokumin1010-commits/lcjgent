ALTER TABLE `line_users` MODIFY COLUMN `lineUserId` varchar(64);--> statement-breakpoint
ALTER TABLE `line_users` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `line_users` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `line_users` ADD CONSTRAINT `line_users_email_unique` UNIQUE(`email`);