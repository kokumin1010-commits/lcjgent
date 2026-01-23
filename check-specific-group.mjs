import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc, like } from "drizzle-orm";
import { int, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

const lineGroups = mysqlTable("line_groups", {
  id: int("id").autoincrement().primaryKey(),
  lineGroupId: varchar("lineGroupId", { length: 64 }).notNull().unique(),
  groupName: varchar("groupName", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  autoFollowUpEnabled: boolean("autoFollowUpEnabled").default(false).notNull(),
  autoFollowUpDays: int("autoFollowUpDays").default(2),
  lastAutoFollowUpAt: timestamp("lastAutoFollowUpAt"),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

const lineMessages = mysqlTable("line_messages", {
  id: int("id").autoincrement().primaryKey(),
  messageId: varchar("messageId", { length: 64 }).notNull().unique(),
  sourceType: varchar("sourceType", { length: 20 }),
  lineGroupId: varchar("lineGroupId", { length: 64 }),
  messageType: varchar("messageType", { length: 50 }),
  content: text("content"),
  direction: varchar("direction", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  
  // Find groups with "売れるネット" in name
  const groups = await db.select().from(lineGroups).where(like(lineGroups.groupName, '%売れるネット%'));
  
  console.log("=== 売れるネット広告社様LCJグループ ===");
  for (const group of groups) {
    console.log(`Group: ${group.groupName}`);
    console.log(`  lineGroupId: ${group.lineGroupId}`);
    console.log(`  isActive: ${group.isActive}`);
    console.log(`  autoFollowUpEnabled: ${group.autoFollowUpEnabled}`);
    console.log(`  autoFollowUpDays: ${group.autoFollowUpDays}`);
    console.log(`  lastMessageAt: ${group.lastMessageAt}`);
    console.log(`  lastAutoFollowUpAt: ${group.lastAutoFollowUpAt}`);
    console.log(`  createdAt: ${group.createdAt}`);
    
    // Get recent messages for this group
    console.log("\n  Recent messages:");
    const messages = await db.select()
      .from(lineMessages)
      .where(eq(lineMessages.lineGroupId, group.lineGroupId))
      .orderBy(desc(lineMessages.createdAt))
      .limit(10);
    
    for (const msg of messages) {
      console.log(`    [${msg.createdAt}] ${msg.direction}: ${msg.content?.substring(0, 50)}...`);
    }
  }
  
  // Current time analysis
  const now = new Date();
  console.log("\n=== Time Analysis ===");
  console.log(`Current time (server): ${now}`);
  console.log(`Current time (UTC): ${now.toUTCString()}`);
  
  // JST time
  const jstOffset = 9 * 60; // JST is UTC+9
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const jstMinutes = utcMinutes + jstOffset;
  const jstHour = Math.floor((jstMinutes % (24 * 60)) / 60);
  console.log(`Current JST hour: ${jstHour}`);
  console.log(`Business hours (JST): 9:00-18:00`);
  console.log(`Within business hours: ${jstHour >= 9 && jstHour < 18}`);
  
  process.exit(0);
}

main().catch(console.error);
