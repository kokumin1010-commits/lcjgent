ALTER TABLE `brand_livestreams` ADD `liverId` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `scheduleId` int;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `livestreamEndTime` timestamp;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `result` enum('成功','失敗');--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `impactFactor` enum('構成','商品','ライバー','広告','その他');--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `resultReason` text;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `screenshotUrl` text;--> statement-breakpoint
ALTER TABLE `brand_livestreams` ADD `screenshotKey` varchar(512);