CREATE TABLE `liver_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liver_id` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`rank` varchar(20) NOT NULL DEFAULT 'none',
	`streaming_hours` decimal(10,2) DEFAULT '0',
	`monthly_sales` decimal(12,2) DEFAULT '0',
	`streaming_credit` decimal(10,2) DEFAULT '0',
	`sales_credit` decimal(10,2) DEFAULT '0',
	`rank_bonus` decimal(10,2) DEFAULT '0',
	`carryover_credit` decimal(10,2) DEFAULT '0',
	`total_credit` decimal(10,2) DEFAULT '0',
	`used_credit` decimal(10,2) DEFAULT '0',
	`remaining_credit` decimal(10,2) DEFAULT '0',
	`is_first_month` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `liver_credits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_brands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brand_name` varchar(255) NOT NULL,
	`brand_type` varchar(100) NOT NULL DEFAULT '',
	`person_in_charge` int,
	`contact_info` text,
	`memo` text,
	`status` enum('registered','email_sent','replied','agreed','cooperating','rejected') NOT NULL DEFAULT 'registered',
	`reject_reason` text,
	`last_followed_at` timestamp,
	`created_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `recruitment_brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recruitment_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recruitment_brand_id` int NOT NULL,
	`old_status` varchar(50),
	`new_status` varchar(50) NOT NULL,
	`changed_by` int,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recruitment_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sample_request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`product_id` int,
	`product_name` varchar(500) NOT NULL,
	`unit_price` decimal(10,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`subtotal` decimal(10,2),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sample_request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sample_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liver_id` int NOT NULL,
	`liver_name` varchar(255) NOT NULL,
	`month` varchar(7) NOT NULL,
	`scheduled_date` timestamp NOT NULL,
	`total_amount` decimal(10,2) DEFAULT '0',
	`credit_used` decimal(10,2) DEFAULT '0',
	`out_of_pocket_amount` decimal(10,2) DEFAULT '0',
	`cash_amount` decimal(10,2) DEFAULT '0',
	`status` varchar(30) NOT NULL DEFAULT 'pending',
	`admin_comment` text,
	`reviewed_by` varchar(255),
	`reviewed_at` timestamp,
	`shipped_at` timestamp,
	`postal_code` varchar(10),
	`address` text,
	`phone` varchar(20),
	`memo` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sample_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `set_application_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`productMasterId` int,
	`productName` varchar(255) NOT NULL,
	`originalPrice` bigint NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `set_application_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `set_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`liverId` int NOT NULL,
	`liverName` varchar(255) NOT NULL,
	`scheduledDate` timestamp,
	`livestreamId` int,
	`setName` varchar(255) NOT NULL,
	`setPrice` bigint NOT NULL,
	`totalOriginalPrice` bigint DEFAULT 0,
	`discountRate` int DEFAULT 0,
	`status` enum('pending','approved','rejected','revision_requested') NOT NULL DEFAULT 'pending',
	`adminComment` text,
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `set_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`referenceId` varchar(64) NOT NULL,
	`paymentTime` timestamp,
	`settlementAmount` int NOT NULL,
	`settlementCurrency` varchar(10) DEFAULT 'JPY',
	`exchangeRate` decimal(10,4) DEFAULT '1',
	`paymentAmount` int NOT NULL,
	`paymentCurrency` varchar(10) DEFAULT 'JPY',
	`importMonth` varchar(7),
	`uploadedBy` int,
	`uploadedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tiktok_tap_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandId` int NOT NULL,
	`importHistoryId` int,
	`dateRange` varchar(50) NOT NULL,
	`reportMonth` varchar(7) NOT NULL,
	`creatorUsername` varchar(255) NOT NULL,
	`productId` varchar(64) NOT NULL,
	`productName` text NOT NULL,
	`shopId` varchar(64),
	`shopName` varchar(255),
	`affiliateGmv` bigint DEFAULT 0,
	`videoGmv` bigint DEFAULT 0,
	`liveGmv` bigint DEFAULT 0,
	`gmvRefund` bigint DEFAULT 0,
	`settledGmv` bigint DEFAULT 0,
	`showcaseRevenue` bigint DEFAULT 0,
	`linkGmv` bigint DEFAULT 0,
	`orders` int DEFAULT 0,
	`salesCount` int DEFAULT 0,
	`linkSalesCount` int DEFAULT 0,
	`linkOrders` int DEFAULT 0,
	`videoViews` bigint DEFAULT 0,
	`liveViews` bigint DEFAULT 0,
	`liveCount` int DEFAULT 0,
	`videoCount` int DEFAULT 0,
	`showcaseProducts` int DEFAULT 0,
	`estimatedPartnerCommission` bigint DEFAULT 0,
	`actualPartnerCommission` bigint DEFAULT 0,
	`estimatedCreatorCommission` bigint DEFAULT 0,
	`actualCreatorCommission` bigint DEFAULT 0,
	`linkEstimatedPartnerCommission` bigint DEFAULT 0,
	`linkEstimatedCreatorCommission` bigint DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tiktok_tap_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tiktok_commission_orders` ADD `source` enum('CAP','TAP') DEFAULT 'CAP';--> statement-breakpoint
ALTER TABLE `tiktok_csv_import_history` ADD `importSource` enum('CAP','TAP','PAYMENT') DEFAULT 'CAP';