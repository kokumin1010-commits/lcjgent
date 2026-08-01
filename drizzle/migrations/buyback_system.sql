-- 中古ブランド買取・オークション連携システム マイグレーション
-- Created: 2026-08-02

CREATE TABLE IF NOT EXISTS `buyback_partners` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company_name` varchar(255) NOT NULL,
  `contact_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `license_number` varchar(100) NOT NULL,
  `line_user_id` varchar(100) DEFAULT NULL,
  `status` enum('active','inactive','suspended') NOT NULL DEFAULT 'active',
  `commission_rate` decimal(5,2) DEFAULT '10.00',
  `total_assessments` int DEFAULT '0',
  `accept_rate` decimal(5,4) DEFAULT NULL,
  `avg_response_time` decimal(10,2) DEFAULT NULL,
  `specialties` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buyback_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_user_id` varchar(100) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `category` enum('bag','watch','jewelry','apparel','shoes','accessory','other') NOT NULL,
  `brand_name` varchar(255) DEFAULT NULL,
  `product_name` varchar(500) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `condition` enum('new','like_new','good','fair','poor') DEFAULT NULL,
  `image_urls` json DEFAULT NULL,
  `status` enum('pending','ai_assessed','partner_assessed','accepted','shipped','received','completed','cancelled','rejected') NOT NULL DEFAULT 'pending',
  `ai_estimated_min` int DEFAULT NULL,
  `ai_estimated_max` int DEFAULT NULL,
  `ai_brand` varchar(255) DEFAULT NULL,
  `ai_model` varchar(500) DEFAULT NULL,
  `ai_condition` varchar(100) DEFAULT NULL,
  `ai_confidence` decimal(3,2) DEFAULT NULL,
  `ai_raw_response` json DEFAULT NULL,
  `selected_partner_id` int DEFAULT NULL,
  `assessment_amount` int DEFAULT NULL,
  `final_amount` int DEFAULT NULL,
  `commission_amount` int DEFAULT NULL,
  `points_awarded` int DEFAULT NULL,
  `shipping_tracking_number` varchar(100) DEFAULT NULL,
  `shipping_carrier` varchar(100) DEFAULT NULL,
  `shipped_at` timestamp NULL DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buyback_requests_line_user` (`line_user_id`),
  KEY `idx_buyback_requests_status` (`status`),
  KEY `idx_buyback_requests_partner` (`selected_partner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buyback_assessments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `partner_id` int NOT NULL,
  `amount` int NOT NULL,
  `note` text DEFAULT NULL,
  `status` enum('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buyback_assessments_request` (`request_id`),
  KEY `idx_buyback_assessments_partner` (`partner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buyback_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `sender_type` enum('user','partner','system') NOT NULL,
  `sender_id` varchar(100) NOT NULL,
  `sender_name` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `image_url` varchar(1000) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buyback_messages_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buyback_transaction_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `actor_type` enum('user','partner','admin','system') NOT NULL,
  `actor_id` varchar(100) NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_buyback_logs_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
