import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Staff master table for managing staff members and their email addresses
 */
export const staff = mysqlTable("staff", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  department: varchar("department", { length: 255 }),
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

/**
 * Tasks table for managing work instructions extracted from screenshots
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("taskId", { length: 64 }).notNull().unique(), // Unique identifier for email threading
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
  staffId: int("staffId").notNull(),
  taskDetail: text("taskDetail").notNull(),
  extractedContext: text("extractedContext"), // Full AI-extracted context
  deadline: timestamp("deadline"),
  screenshotUrl: text("screenshotUrl"), // DEPRECATED: Use screenshotUrls instead
  screenshotKey: varchar("screenshotKey", { length: 512 }), // DEPRECATED: Use screenshotKeys instead
  screenshotUrls: json("screenshotUrls").$type<string[]>(), // Array of S3 URLs (up to 4 screenshots)
  screenshotKeys: json("screenshotKeys").$type<string[]>(), // Array of S3 keys (up to 4 screenshots)
  completionToken: varchar("completionToken", { length: 128 }), // Token for one-click completion
  notes: text("notes"), // Optional memo field for additional task details
  startDate: bigint("startDate", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
  completedAt: bigint("completedAt", { mode: "number" }), // UTC timestamp in milliseconds
  lastReminderAt: bigint("lastReminderAt", { mode: "number" }), // Last reminder sent timestamp in milliseconds
  createdBy: int("createdBy").notNull(), // User ID who created the task
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Reminders table for tracking reminder emails sent to staff
 */
export const reminders = mysqlTable("reminders", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  sentAt: bigint("sentAt", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  emailSubject: text("emailSubject"),
  emailBody: text("emailBody"),
  status: mysqlEnum("status", ["sent", "failed", "bounced"]).default("sent").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reminder = typeof reminders.$inferSelect;
export type InsertReminder = typeof reminders.$inferInsert;

/**
 * Task-Staff junction table for many-to-many relationship
 * Allows assigning multiple staff members to a single task
 */
export const taskStaff = mysqlTable("task_staff", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(), // References tasks.id
  staffId: int("staffId").notNull(), // References staff.id
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
});

export type TaskStaff = typeof taskStaff.$inferSelect;
export type InsertTaskStaff = typeof taskStaff.$inferInsert;
