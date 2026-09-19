CREATE TABLE IF NOT EXISTS `line_group_lifecycle_states` (
  `lineGroupId` varchar(64) NOT NULL,
  `lastEventAt` bigint NOT NULL,
  `lastEventId` varchar(64) NOT NULL,
  `isActive` boolean NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `line_group_lifecycle_states_lineGroupId_pk` PRIMARY KEY (`lineGroupId`)
);
