ALTER TABLE `users`
  ADD COLUMN `sessionVersion` INT NOT NULL DEFAULT 1 AFTER `role`;
