CREATE TABLE `campaign_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaign_id` int NOT NULL,
	`stage_number` int NOT NULL,
	`required_referrals` int NOT NULL,
	`fixed_reward` int NOT NULL,
	`spin_count` int NOT NULL DEFAULT 1,
	`is_special_spin` boolean NOT NULL DEFAULT false,
	`stage_emoji` varchar(10) NOT NULL DEFAULT '🌸',
	`stage_name` varchar(50) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `friend_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrer_line_user_id` int NOT NULL,
	`invitee_line_user_id` int NOT NULL,
	`campaign_id` int NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'completed',
	`referrer_points_awarded` int NOT NULL DEFAULT 0,
	`invitee_points_awarded` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `friend_referrals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_activity_feed` (
	`id` int AUTO_INCREMENT NOT NULL,
	`line_user_id` int,
	`activity_type` varchar(30) NOT NULL,
	`message` text NOT NULL,
	`points_amount` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_activity_feed_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referral_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`start_date` timestamp,
	`end_date` timestamp,
	`max_daily_referrals` int NOT NULL DEFAULT 5,
	`monthly_point_cap` int NOT NULL DEFAULT 5000,
	`invitee_bonus` int NOT NULL DEFAULT 50,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spin_reward_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`table_id` int NOT NULL,
	`label` varchar(50) NOT NULL,
	`emoji` varchar(10) NOT NULL DEFAULT '🎀',
	`points` int NOT NULL,
	`probability` decimal(5,4) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT '#ec4899',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spin_reward_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spin_reward_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`is_special` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spin_reward_tables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_referral_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`line_user_id` int NOT NULL,
	`campaign_id` int NOT NULL,
	`referral_code` varchar(20) NOT NULL,
	`total_referrals` int NOT NULL DEFAULT 0,
	`current_stage` int NOT NULL DEFAULT 0,
	`total_points_earned` int NOT NULL DEFAULT 0,
	`pending_spins` int NOT NULL DEFAULT 0,
	`pending_special_spins` int NOT NULL DEFAULT 0,
	`title_level` varchar(20) NOT NULL DEFAULT 'none',
	`monthly_points_earned` int NOT NULL DEFAULT 0,
	`monthly_points_reset_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_referral_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_spin_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`line_user_id` int NOT NULL,
	`campaign_id` int NOT NULL,
	`reward_item_id` int NOT NULL,
	`points_won` int NOT NULL,
	`is_special_spin` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_spin_history_id` PRIMARY KEY(`id`)
);
