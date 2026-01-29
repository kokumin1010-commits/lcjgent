ALTER TABLE `livers` ADD `lineUserId` varchar(255);--> statement-breakpoint
ALTER TABLE `livers` ADD `lineNotificationEnabled` boolean DEFAULT true;