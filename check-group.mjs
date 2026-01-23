import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [rows] = await connection.execute(
  "SELECT id, lineGroupId, groupName, autoFollowUpEnabled, autoFollowUpDays, lastMessageAt, lastAutoFollowUpAt, createdAt, isActive FROM line_groups WHERE groupName LIKE '%売れるネット%'"
);

console.log('Group data:', JSON.stringify(rows, null, 2));

// Calculate days since last message
if (rows.length > 0) {
  const group = rows[0];
  const lastActivity = group.lastMessageAt || group.createdAt;
  const now = new Date();
  const daysSinceLastMessage = Math.floor(
    (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
  );
  console.log('\nAnalysis:');
  console.log('- autoFollowUpEnabled:', group.autoFollowUpEnabled);
  console.log('- autoFollowUpDays:', group.autoFollowUpDays);
  console.log('- lastMessageAt:', group.lastMessageAt);
  console.log('- lastAutoFollowUpAt:', group.lastAutoFollowUpAt);
  console.log('- createdAt:', group.createdAt);
  console.log('- isActive:', group.isActive);
  console.log('- Days since last message:', daysSinceLastMessage);
  console.log('- Should send follow-up:', daysSinceLastMessage >= (group.autoFollowUpDays || 2));
}

await connection.end();
