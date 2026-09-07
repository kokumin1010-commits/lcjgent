CREATE TABLE IF NOT EXISTS `lcf_vip_eligibilities` (
		`ticketId` varchar(20) NOT NULL,
		`identityHash` char(64) NOT NULL,
		`sourceBatch` varchar(80) NOT NULL,
		`active` tinyint(1) NOT NULL DEFAULT 1,
		`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
		`createdByAdminId` int,
		`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
		`updatedByAdminId` int,
		CONSTRAINT `lcf_vip_eligibilities_ticketId` PRIMARY KEY(`ticketId`),
		KEY `idx_lcf_vip_identity` (`identityHash`,`active`),
		KEY `idx_lcf_vip_active` (`active`,`updatedAt`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `lcf_vip_audit_logs` (
		`id` bigint AUTO_INCREMENT NOT NULL,
		`requestId` varchar(80) NOT NULL,
		`action` enum('batch_apply','manual_enable','manual_disable') NOT NULL,
		`ticketId` varchar(20),
		`sourceBatch` varchar(80) NOT NULL,
		`actorAdminId` int,
		`affectedCount` int NOT NULL DEFAULT 0,
		`detailHash` char(64) NOT NULL,
		`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
		CONSTRAINT `lcf_vip_audit_logs_id` PRIMARY KEY(`id`),
		CONSTRAINT `uk_lcf_vip_audit_request` UNIQUE(`requestId`),
		KEY `idx_lcf_vip_audit_created` (`createdAt`),
		KEY `idx_lcf_vip_audit_ticket` (`ticketId`,`createdAt`)
);
