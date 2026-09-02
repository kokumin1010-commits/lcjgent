ALTER TABLE `staff_schedules`
  ADD COLUMN `isFollowBroadcast` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `staff_schedules`
  ADD COLUMN `followLiverId` int NULL;
--> statement-breakpoint
ALTER TABLE `staff_schedules`
  ADD COLUMN `followLiverName` varchar(255) NULL;
--> statement-breakpoint
ALTER TABLE `staff_schedules`
  ADD COLUMN `followStartTime` varchar(10) NULL;
--> statement-breakpoint
ALTER TABLE `staff_schedules`
  ADD COLUMN `followEndTime` varchar(10) NULL;
