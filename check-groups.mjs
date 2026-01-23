import { drizzle } from "drizzle-orm/mysql2";
import { eq, and, desc } from "drizzle-orm";
import { int, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";

// Define the schema inline
const lineGroups = mysqlTable("line_groups", {
  id: int("id").autoincrement().primaryKey(),
  lineGroupId: varchar("lineGroupId", { length: 64 }).notNull().unique(),
  groupName: varchar("groupName", { length: 255 }),
  pictureUrl: text("pictureUrl"),
  brandId: int("brandId"),
  isActive: boolean("isActive").default(true).notNull(),
  notificationsEnabled: boolean("notificationsEnabled").default(true).notNull(),
  autoFollowUpEnabled: boolean("autoFollowUpEnabled").default(false).notNull(),
  autoFollowUpDays: int("autoFollowUpDays").default(2),
  autoFollowUpMessage: text("autoFollowUpMessage"),
  lastAutoFollowUpAt: timestamp("lastAutoFollowUpAt"),
  lastMessageAt: timestamp("lastMessageAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

async function main() {
  const db = drizzle(process.env.DATABASE_URL);
  
  console.log("=== All Groups ===");
  const groups = await db.select().from(lineGroups).orderBy(desc(lineGroups.createdAt));
  
  for (const group of groups) {
    const now = new Date();
    const lastActivity = group.lastMessageAt || group.createdAt;
    const daysSinceLastMessage = Math.floor(
      (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    console.log(`\n--- Group: ${group.groupName || 'Unknown'} ---`);
    console.log(`  ID: ${group.lineGroupId.substring(0, 20)}...`);
    console.log(`  isActive: ${group.isActive}`);
    console.log(`  autoFollowUpEnabled: ${group.autoFollowUpEnabled}`);
    console.log(`  autoFollowUpDays: ${group.autoFollowUpDays}`);
    console.log(`  lastMessageAt: ${group.lastMessageAt}`);
    console.log(`  lastAutoFollowUpAt: ${group.lastAutoFollowUpAt}`);
    console.log(`  createdAt: ${group.createdAt}`);
    console.log(`  Days since last message: ${daysSinceLastMessage}`);
    
    // Check if this group needs follow-up
    const inactiveDays = group.autoFollowUpDays || 2;
    const lastFollowUp = group.lastAutoFollowUpAt;
    
    if (group.isActive && group.autoFollowUpEnabled) {
      if (daysSinceLastMessage >= inactiveDays) {
        if (!lastFollowUp || new Date(lastFollowUp) < new Date(lastActivity)) {
          console.log(`  *** NEEDS FOLLOW-UP ***`);
        } else {
          console.log(`  Already followed up after last activity`);
        }
      } else {
        console.log(`  Not inactive long enough (${daysSinceLastMessage}/${inactiveDays} days)`);
      }
    } else {
      console.log(`  Follow-up disabled or group inactive`);
    }
  }
  
  console.log("\n=== Groups Needing Follow-up ===");
  const activeGroups = groups.filter(g => g.isActive && g.autoFollowUpEnabled);
  console.log(`Active groups with follow-up enabled: ${activeGroups.length}`);
  
  process.exit(0);
}

main().catch(console.error);
