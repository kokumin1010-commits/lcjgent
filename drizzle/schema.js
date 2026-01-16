"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reports = exports.emailTracking = exports.taskStaff = exports.reminders = exports.tasks = exports.staff = exports.users = void 0;
const mysql_core_1 = require("drizzle-orm/mysql-core");
/**
 * Core user table backing auth flow.
 */
exports.users = (0, mysql_core_1.mysqlTable)("users", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    email: (0, mysql_core_1.varchar)("email", { length: 320 }).notNull().unique(),
    password: (0, mysql_core_1.varchar)("password", { length: 255 }).notNull(),
    name: (0, mysql_core_1.text)("name"),
    role: (0, mysql_core_1.mysqlEnum)("role", ["user", "admin"]).default("user").notNull(),
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: (0, mysql_core_1.timestamp)("lastSignedIn").defaultNow().notNull(),
});
/**
 * Staff master table for managing staff members and their email addresses
 */
exports.staff = (0, mysql_core_1.mysqlTable)("staff", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    name: (0, mysql_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, mysql_core_1.varchar)("email", { length: 320 }).notNull(),
    department: (0, mysql_core_1.varchar)("department", { length: 255 }),
    isActive: (0, mysql_core_1.mysqlEnum)("isActive", ["active", "inactive"]).default("active").notNull(),
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Tasks table for managing work instructions extracted from screenshots
 */
exports.tasks = (0, mysql_core_1.mysqlTable)("tasks", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    taskId: (0, mysql_core_1.varchar)("taskId", { length: 64 }).notNull().unique(), // Unique identifier for email threading
    status: (0, mysql_core_1.mysqlEnum)("status", ["pending", "in_progress", "completed", "cancelled"]).default("pending").notNull(),
    staffId: (0, mysql_core_1.int)("staffId").notNull(),
    taskDetail: (0, mysql_core_1.text)("taskDetail").notNull(),
    extractedContext: (0, mysql_core_1.text)("extractedContext"), // Full AI-extracted context
    deadline: (0, mysql_core_1.timestamp)("deadline"),
    screenshotUrl: (0, mysql_core_1.text)("screenshotUrl"), // DEPRECATED: Use screenshotUrls instead
    screenshotKey: (0, mysql_core_1.varchar)("screenshotKey", { length: 512 }), // DEPRECATED: Use screenshotKeys instead
    screenshotUrls: (0, mysql_core_1.json)("screenshotUrls").$type(), // Array of S3 URLs (up to 4 screenshots)
    screenshotKeys: (0, mysql_core_1.json)("screenshotKeys").$type(), // Array of S3 keys (up to 4 screenshots)
    completionToken: (0, mysql_core_1.varchar)("completionToken", { length: 128 }), // Token for one-click completion
    notes: (0, mysql_core_1.text)("notes"), // Optional memo field for additional task details
    startDate: (0, mysql_core_1.bigint)("startDate", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
    completedAt: (0, mysql_core_1.bigint)("completedAt", { mode: "number" }), // UTC timestamp in milliseconds
    lastReminderAt: (0, mysql_core_1.bigint)("lastReminderAt", { mode: "number" }), // Last reminder sent timestamp in milliseconds
    createdBy: (0, mysql_core_1.int)("createdBy").notNull(), // User ID who created the task
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Reminders table for tracking reminder emails sent to staff
 */
exports.reminders = (0, mysql_core_1.mysqlTable)("reminders", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    taskId: (0, mysql_core_1.int)("taskId").notNull(),
    sentAt: (0, mysql_core_1.bigint)("sentAt", { mode: "number" }).notNull(), // UTC timestamp in milliseconds
    recipientEmail: (0, mysql_core_1.varchar)("recipientEmail", { length: 320 }).notNull(),
    emailSubject: (0, mysql_core_1.text)("emailSubject"),
    emailBody: (0, mysql_core_1.text)("emailBody"),
    status: (0, mysql_core_1.mysqlEnum)("status", ["sent", "failed", "bounced"]).default("sent").notNull(),
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
});
/**
 * Task-Staff junction table for many-to-many relationship
 * Allows assigning multiple staff members to a single task
 */
exports.taskStaff = (0, mysql_core_1.mysqlTable)("task_staff", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    taskId: (0, mysql_core_1.int)("taskId").notNull(), // References tasks.id
    staffId: (0, mysql_core_1.int)("staffId").notNull(), // References staff.id
    assignedAt: (0, mysql_core_1.timestamp)("assignedAt").defaultNow().notNull(),
});
/**
 * Email tracking table for monitoring email opens
 * Tracks when reminder emails are opened by recipients
 */
exports.emailTracking = (0, mysql_core_1.mysqlTable)("email_tracking", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    reminderId: (0, mysql_core_1.int)("reminderId").notNull(), // References reminders.id
    taskId: (0, mysql_core_1.int)("taskId").notNull(), // References tasks.id
    trackingToken: (0, mysql_core_1.varchar)("trackingToken", { length: 128 }).notNull().unique(), // Unique token for tracking
    openedAt: (0, mysql_core_1.bigint)("openedAt", { mode: "number" }), // UTC timestamp in milliseconds when email was opened
    openCount: (0, mysql_core_1.int)("openCount").default(0).notNull(), // Number of times email was opened
    ipAddress: (0, mysql_core_1.varchar)("ipAddress", { length: 45 }), // IP address of the opener (IPv4 or IPv6)
    userAgent: (0, mysql_core_1.text)("userAgent"), // Browser/email client user agent
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
});
/**
 * Daily reports table for staff daily work reports
 * Mirrors the existing WordPress report system structure
 */
exports.reports = (0, mysql_core_1.mysqlTable)("reports", {
    id: (0, mysql_core_1.int)("id").autoincrement().primaryKey(),
    staffId: (0, mysql_core_1.int)("staffId").notNull(), // References staff.id
    reportDate: (0, mysql_core_1.timestamp)("reportDate").notNull(), // Date of the report
    workContent: (0, mysql_core_1.text)("workContent").notNull(), // 業務内容
    issues: (0, mysql_core_1.text)("issues"), // 気付き・問題・理由
    remarks: (0, mysql_core_1.text)("remarks"), // 備考
    createdBy: (0, mysql_core_1.int)("createdBy").notNull(), // User ID who created the report
    createdAt: (0, mysql_core_1.timestamp)("createdAt").defaultNow().notNull(),
    updatedAt: (0, mysql_core_1.timestamp)("updatedAt").defaultNow().onUpdateNow().notNull(),
});
