CREATE INDEX `idx_line_messages_user_history`
  ON `line_messages` (`lineUserId`, `id`);
