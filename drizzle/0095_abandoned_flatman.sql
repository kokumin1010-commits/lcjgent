CREATE TABLE `aitherhub_sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`syncStatus` enum('success','error','partial') NOT NULL,
	`liverId` int,
	`liverEmail` varchar(255),
	`streamerName` varchar(255),
	`brandId` int,
	`livestreamId` int,
	`livestreamDate` timestamp,
	`syncAction` enum('created','updated','skipped'),
	`recordsProcessed` int DEFAULT 0,
	`message` text,
	`errorDetail` text,
	`requestSummary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aitherhub_sync_logs_id` PRIMARY KEY(`id`)
);
