CREATE TABLE IF NOT EXISTS `ipo_monthly_plans` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `month` VARCHAR(7) NOT NULL,
  `revenueTargetJpy` DECIMAL(18,2) NULL,
  `grossProfitTargetJpy` DECIMAL(18,2) NULL,
  `operatingProfitTargetJpy` DECIMAL(18,2) NULL,
  `note` VARCHAR(1000) NULL,
  `createdBy` BIGINT NULL,
  `updatedBy` BIGINT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ipo_monthly_plan_month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ipo_readiness_settings` (
  `settingKey` VARCHAR(64) NOT NULL,
  `targetOperatingMarginPct` DECIMAL(8,4) NULL,
  `downsideFactor` DECIMAL(8,4) NOT NULL DEFAULT 0.8,
  `baseFactor` DECIMAL(8,4) NOT NULL DEFAULT 1,
  `upsideFactor` DECIMAL(8,4) NOT NULL DEFAULT 1.2,
  `monthlyCloseDueDay` INT NOT NULL DEFAULT 10,
  `createdBy` BIGINT NULL,
  `updatedBy` BIGINT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`settingKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ipo_readiness_tasks` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `templateKey` VARCHAR(100) NULL,
  `workstream` ENUM('finance_close','audit','internal_control','governance','legal_disclosure','information_systems','capital_markets') NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `ownerName` VARCHAR(255) NULL,
  `priority` ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` ENUM('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
  `progress` INT NOT NULL DEFAULT 0,
  `dueDate` DATE NULL,
  `blocker` TEXT NULL,
  `evidenceJson` JSON NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `completedAt` TIMESTAMP NULL,
  `deletedAt` TIMESTAMP NULL,
  `createdBy` BIGINT NULL,
  `updatedBy` BIGINT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ipo_task_template` (`templateKey`),
  KEY `idx_ipo_task_list` (`workstream`,`status`,`dueDate`,`deletedAt`),
  KEY `idx_ipo_task_priority` (`priority`,`status`,`dueDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ipo_board_report_snapshots` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `seriesKey` VARCHAR(64) NOT NULL,
  `asOfMonth` VARCHAR(7) NOT NULL,
  `versionNumber` INT NOT NULL DEFAULT 1,
  `title` VARCHAR(500) NOT NULL,
  `status` ENUM('draft','final') NOT NULL DEFAULT 'draft',
  `summaryJson` JSON NOT NULL,
  `generatedBy` BIGINT NULL,
  `generatedByName` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ipo_board_series_version` (`seriesKey`,`versionNumber`),
  KEY `idx_ipo_board_month` (`asOfMonth`,`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ipo_readiness_audit_logs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `entityType` ENUM('monthly_plan','settings','task','board_report') NOT NULL,
  `entityId` BIGINT NULL,
  `action` VARCHAR(100) NOT NULL,
  `beforeJson` JSON NULL,
  `afterJson` JSON NULL,
  `actorId` BIGINT NULL,
  `actorName` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ipo_audit_entity` (`entityType`,`entityId`,`createdAt`),
  KEY `idx_ipo_audit_time` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `ipo_readiness_settings`
  (`settingKey`,`targetOperatingMarginPct`,`downsideFactor`,`baseFactor`,`upsideFactor`,`monthlyCloseDueDay`)
VALUES ('default',NULL,0.8,1,1.2,10);

INSERT IGNORE INTO `ipo_readiness_tasks`
  (`templateKey`,`workstream`,`title`,`description`,`priority`,`status`,`progress`,`sortOrder`)
VALUES
  ('monthly-close-policy','finance_close','月次決算と会計方針を固定','売上、売上原価、在庫、未収未払、減価償却、税金を含む月次決算手順と締切を文書化する。','critical','todo',0,10),
  ('bank-reconciliation','finance_close','銀行残高と会計帳簿を毎月照合','全口座の銀行残高、会計帳簿、内部送金の差異を月次で解消し、証拠を保存する。','critical','todo',0,20),
  ('inventory-ar-ap','finance_close','在庫・売掛・買掛の月次照合','在庫評価、売掛金回収、買掛金残高の明細と総勘定元帳を一致させる。','high','todo',0,30),
  ('audit-firm-plan','audit','監査法人と監査計画を確定','監査法人、監査対象期間、提出資料、期中レビューと期末監査の日程を確定する。','critical','todo',0,40),
  ('audit-evidence-room','audit','監査証拠一覧を整備','財務諸表、銀行、請求書、契約、在庫、税務、取締役会資料の証拠所在を一覧化する。','high','todo',0,50),
  ('related-party-register','legal_disclosure','関連当事者取引台帳を整備','役員、株主、グループ会社との取引を識別し、承認、価格根拠、開示資料を保存する。','critical','todo',0,60),
  ('board-governance','governance','取締役会運営と規程を整備','取締役会の権限、開催、議事録、決裁基準、利益相反管理を継続運用する。','high','todo',0,70),
  ('whistleblowing','governance','内部通報と不祥事対応を整備','通報窓口、匿名性、調査、是正、再発防止と取締役会報告の手順を文書化する。','high','todo',0,80),
  ('internal-controls','internal_control','主要業務プロセスの内部統制を文書化','売上、購買、在庫、給与、支払、IT権限の承認、実行、記録、照合を分離する。','critical','todo',0,90),
  ('access-control','information_systems','システム権限と変更管理を整備','入退社、特権ID、二次認証、変更承認、ログ保全、バックアップ復旧を定期点検する。','high','todo',0,100),
  ('contracts-disclosure','legal_disclosure','重要契約とリスク開示を整理','重要契約、許認可、紛争、個人情報、知的財産と事業リスクの証拠を一覧化する。','high','todo',0,110),
  ('capital-policy','capital_markets','資本政策と株主構成を確定','完全希薄化後株式数、ストックオプション、資金調達方針、主要株主とロックアップ論点を整理する。','high','todo',0,120),
  ('timely-disclosure','capital_markets','適時開示体制を構築','重要事実の収集、判断、承認、開示、インサイダー情報管理の責任者と手順を確定する。','critical','todo',0,130);
