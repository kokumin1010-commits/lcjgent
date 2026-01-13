import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";
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
    screenshotUrl: text("screenshotUrl"), // S3 URL of the uploaded screenshot
    screenshotKey: varchar("screenshotKey", { length: 512 }), // S3 key for the screenshot
    startDate: bigint("startDate", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
    completedAt: bigint("completedAt", { mode: "number" }), // UTC timestamp in milliseconds
    createdBy: int("createdBy").notNull(), // User ID who created the task
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
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
