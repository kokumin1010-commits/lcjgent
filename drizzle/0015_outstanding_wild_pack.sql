ALTER TABLE `report_followups` ADD `resultCategory` enum('成約','継続','保留','失注','完了');--> statement-breakpoint
ALTER TABLE `report_followups` ADD `resultNote` text;--> statement-breakpoint
ALTER TABLE `report_followups` ADD `nextActionId` int;