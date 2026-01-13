-- Insert test staff
INSERT INTO staff (name, email, department, isActive) 
VALUES ('テスト担当者', 'ryuhairartist@gmail.com', 'テスト部門', 'active');

-- Get the last inserted staff ID and insert test task
SET @staff_id = LAST_INSERT_ID();
INSERT INTO tasks (taskId, staffId, taskDetail, extractedContext, status, startDate, createdBy)
VALUES (
  CONCAT('TASK-TEST-', UNIX_TIMESTAMP()),
  @staff_id,
  'これはリマインドメールのテストタスクです。担当者への自動リマインド機能が正常に動作するかを確認します。',
  'テストコンテキスト: 12時間ごとの自動リマインド送信機能のテスト',
  'in_progress',
  UNIX_TIMESTAMP() * 1000 - (2 * 24 * 60 * 60 * 1000),
  1
);
