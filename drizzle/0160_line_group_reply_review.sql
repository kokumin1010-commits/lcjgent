CREATE INDEX `idx_line_messages_group_direction_history`
  ON `line_messages` (`lineGroupId`, `sourceType`, `direction`, `lineTimestamp`, `id`);
