import { eq, and, desc, asc, sql, or, like, inArray, not, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staff, InsertStaff, tasks, InsertTask, reminders, InsertReminder, taskStaff, InsertTaskStaff, emailTracking, InsertEmailTracking, reportStaff, InsertReportStaff, reports, InsertReport, brands, InsertBrand, brandProducts, InsertBrandProduct, brandActivities, InsertBrandActivity, brandLivestreams, InsertBrandLivestream, reportFollowups, InsertReportFollowup, businessCards, InsertBusinessCard, brandLcjStaff, InsertBrandLcjStaff, activityLogs, InsertActivityLog, brandContracts, InsertBrandContract, reportAiAdvice, InsertReportAiAdvice, aiAdviceFeedback, InsertAiAdviceFeedback, aiLearningExamples, InsertAiLearningExample, chatReportSessions, InsertChatReportSession, chatReportMessages, InsertChatReportMessage, staffAiProfiles, InsertStaffAiProfile, aiQuestionTemplates, InsertAiQuestionTemplate, lineUsers, InsertLineUser, lineGroups, InsertLineGroup, lineMessages, InsertLineMessage, lineFollowUps, InsertLineFollowUp, schedules, InsertSchedule, livers, InsertLiver, livestreamProducts, InsertLivestreamProduct, brandMemos, InsertBrandMemo, contractLivestreamLinks, InsertContractLivestreamLink, brandEditLogs, InsertBrandEditLog, brandProductImages, InsertBrandProductImage, brandFiles, InsertBrandFile, productLinks, InsertProductLink } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User management functions
export async function createUser(userData: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(users).values(userData);
  return result;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserLastSignedIn(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

// Staff management functions
export async function createStaff(staffData: InsertStaff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(staff).values(staffData);
  return result;
}

export async function getAllStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(staff).orderBy(desc(staff.createdAt));
}

export async function getActiveStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(staff).where(eq(staff.isActive, "active")).orderBy(staff.name);
}

export async function getStaffById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateStaff(id: number, staffData: Partial<InsertStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(staff).set(staffData).where(eq(staff.id, id));
}

export async function deleteStaff(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(staff).where(eq(staff.id, id));
}

// Task management functions
export async function createTask(taskData: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert and return the inserted row
  const [insertedTask] = await db.insert(tasks).values(taskData).$returningId();
  
  // Fetch the complete task record
  if (insertedTask && insertedTask.id) {
    const result = await db.select().from(tasks).where(eq(tasks.id, insertedTask.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  
  return null;
}

export async function getAllTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .orderBy(desc(tasks.createdAt));
}

export async function getAllTasksWithUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .orderBy(desc(tasks.createdAt));
}

export async function getTasksByStatus(status: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, status as any))
    .orderBy(desc(tasks.createdAt));
}

export async function getTasksByStaffId(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.staffId, staffId))
    .orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTaskByTaskId(taskId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.taskId, taskId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getTaskByCompletionToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.completionToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateTask(id: number, taskData: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(tasks).set(taskData).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(tasks).where(eq(tasks.id, id));
}

export async function searchTasks(searchTerm: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(
      or(
        like(tasks.taskDetail, `%${searchTerm}%`),
        like(tasks.extractedContext, `%${searchTerm}%`),
        like(staff.name, `%${searchTerm}%`)
      )
    )
    .orderBy(desc(tasks.createdAt));
}

export async function getInProgressTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, "in_progress"))
    .orderBy(desc(tasks.createdAt));
}

// Reminder management functions
export async function createReminder(reminderData: InsertReminder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(reminders).values(reminderData);
  return result;
}

export async function getRemindersByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(reminders)
    .where(eq(reminders.taskId, taskId))
    .orderBy(desc(reminders.sentAt));
}

// Dashboard statistics functions
export async function getTaskStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const totalTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks);
  const pendingTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "pending"));
  const inProgressTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "in_progress"));
  const completedTasks = await db.select({ count: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "completed"));

  return {
    total: totalTasks[0]?.count || 0,
    pending: pendingTasks[0]?.count || 0,
    inProgress: inProgressTasks[0]?.count || 0,
    completed: completedTasks[0]?.count || 0,
  };
}

export async function getAverageCompletionTime() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const completedTasksWithTime = await db
    .select({
      startDate: tasks.startDate,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(and(eq(tasks.status, "completed"), sql`${tasks.completedAt} IS NOT NULL`));

  if (completedTasksWithTime.length === 0) return 0;

  const totalTime = completedTasksWithTime.reduce((sum, task) => {
    if (task.startDate && task.completedAt) {
      return sum + (task.completedAt - task.startDate);
    }
    return sum;
  }, 0);

  return totalTime / completedTasksWithTime.length;
}

export async function getRecentCompletedTasks(limit: number = 10) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(eq(tasks.status, "completed"))
    .orderBy(desc(tasks.completedAt))
    .limit(limit);
}

export async function getStaffWithTaskCounts() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get only active staff
  const allStaff = await db.select().from(staff).where(eq(staff.isActive, "active"));
  const now = Date.now();
  
  const staffWithCounts = await Promise.all(
    allStaff.map(async (s) => {
      // Count in_progress tasks (not completed)
      const inProgressResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(and(eq(tasks.staffId, s.id), eq(tasks.status, "in_progress")));
      
      // Count overdue tasks (deadline passed and not completed)
      const overdueResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.staffId, s.id),
            or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
            sql`UNIX_TIMESTAMP(${tasks.deadline}) * 1000 < ${now}`
          )
        );
      
      const inProgressCount = Number(inProgressResult[0]?.count || 0);
      const overdueCount = Number(overdueResult[0]?.count || 0);
      
      return {
        ...s,
        inProgressCount,
        overdueCount,
      };
    })
  );

  return staffWithCounts;
}

export async function getOverdueTasks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = Date.now();
  
  return await db
    .select({
      task: tasks,
      staff: staff,
    })
    .from(tasks)
    .leftJoin(staff, eq(tasks.staffId, staff.id))
    .where(
      and(
        or(eq(tasks.status, "pending"), eq(tasks.status, "in_progress")),
        sql`${tasks.deadline} < ${now}`
      )
    )
    .orderBy(asc(tasks.deadline));
}

// Task-Staff junction table functions
export async function assignStaffToTask(taskId: number, staffIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Insert multiple staff assignments
  const assignments = staffIds.map(staffId => ({
    taskId,
    staffId,
  }));

  return await db.insert(taskStaff).values(assignments);
}

export async function getStaffByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      staff: staff,
      assignedAt: taskStaff.assignedAt,
    })
    .from(taskStaff)
    .leftJoin(staff, eq(taskStaff.staffId, staff.id))
    .where(eq(taskStaff.taskId, taskId))
    .orderBy(taskStaff.assignedAt);
}

export async function removeStaffFromTask(taskId: number, staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .delete(taskStaff)
    .where(and(eq(taskStaff.taskId, taskId), eq(taskStaff.staffId, staffId)));
}

export async function removeAllStaffFromTask(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(taskStaff).where(eq(taskStaff.taskId, taskId));
}

// Email tracking functions
export async function createEmailTracking(trackingData: InsertEmailTracking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(emailTracking).values(trackingData);
  return result;
}

export async function getEmailTrackingByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select()
    .from(emailTracking)
    .where(eq(emailTracking.trackingToken, token))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getEmailTrackingByTaskId(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select()
    .from(emailTracking)
    .where(eq(emailTracking.taskId, taskId))
    .orderBy(desc(emailTracking.createdAt));
}


// Report Staff management functions
export async function createReportStaff(data: InsertReportStaff) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [inserted] = await db.insert(reportStaff).values(data).$returningId();
  if (inserted && inserted.id) {
    const result = await db.select().from(reportStaff).where(eq(reportStaff.id, inserted.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  return null;
}

export async function getAllReportStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff).orderBy(asc(reportStaff.name));
}

export async function getActiveReportStaff() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff).where(eq(reportStaff.isActive, "active")).orderBy(asc(reportStaff.name));
}

export async function getReportStaffById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(reportStaff).where(eq(reportStaff.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReportStaff(id: number, data: Partial<InsertReportStaff>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(reportStaff).set(data).where(eq(reportStaff.id, id));
}

export async function deleteReportStaff(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(reportStaff).where(eq(reportStaff.id, id));
}

export async function getReportStaffByCountry(country: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(reportStaff)
    .where(and(eq(reportStaff.country, country), eq(reportStaff.isActive, "active")))
    .orderBy(asc(reportStaff.name));
}

// Report management functions
export async function createReport(reportData: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [insertedReport] = await db.insert(reports).values(reportData).$returningId();
  
  if (insertedReport && insertedReport.id) {
    const result = await db.select().from(reports).where(eq(reports.id, insertedReport.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  
  return null;
}

export async function getAllReports() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .orderBy(desc(reports.reportDate));
}

export async function getReportsByReportStaffId(reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(eq(reports.reportStaffId, reportStaffId))
    .orderBy(desc(reports.reportDate));
}

export async function getReportsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(
      and(
        sql`${reports.reportDate} >= ${startDate}`,
        sql`${reports.reportDate} <= ${endDate}`
      )
    )
    .orderBy(desc(reports.reportDate));
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id))
    .where(eq(reports.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateReport(id: number, reportData: Partial<InsertReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(reports).set(reportData).where(eq(reports.id, id));
}

export async function deleteReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(reports).where(eq(reports.id, id));
}

export async function getStaffReportStatistics() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all active report staff
  const allReportStaff = await db.select().from(reportStaff).where(eq(reportStaff.isActive, "active"));
  
  // Get current month date range
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  
  const staffWithCounts = await Promise.all(
    allReportStaff.map(async (s) => {
      // Count reports for current month
      const monthlyResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(
          and(
            eq(reports.reportStaffId, s.id),
            sql`${reports.reportDate} >= ${firstDayOfMonth}`,
            sql`${reports.reportDate} <= ${lastDayOfMonth}`
          )
        );
      
      // Count total reports
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(reports)
        .where(eq(reports.reportStaffId, s.id));
      
      const monthlyCount = Number(monthlyResult[0]?.count || 0);
      const totalCount = Number(totalResult[0]?.count || 0);
      
      // Calculate days in month and expected reports
      const daysInMonth = lastDayOfMonth.getDate();
      const dayOfMonth = now.getDate();
      
      return {
        ...s,
        linkedStaffId: s.linkedStaffId,
        monthlyCount,
        totalCount,
        daysInMonth,
        dayOfMonth,
      };
    })
  );

  return staffWithCounts;
}

export async function searchReports(filters: {
  reportStaffId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  
  if (filters.reportStaffId) {
    conditions.push(eq(reports.reportStaffId, filters.reportStaffId));
  }
  
  if (filters.startDate) {
    conditions.push(sql`${reports.reportDate} >= ${filters.startDate}`);
  }
  
  if (filters.endDate) {
    conditions.push(sql`${reports.reportDate} <= ${filters.endDate}`);
  }
  
  if (filters.searchTerm) {
    conditions.push(
      or(
        like(reports.workContent, `%${filters.searchTerm}%`),
        like(reports.issues, `%${filters.searchTerm}%`),
        like(reports.remarks, `%${filters.searchTerm}%`)
      )
    );
  }

  const query = db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id));

  if (conditions.length > 0) {
    return await query.where(and(...conditions)).orderBy(desc(reports.reportDate));
  }

  return await query.orderBy(desc(reports.reportDate));
}

// Get reports for AI analysis (by date range and optionally by staff)
export async function getReportsForAnalysis(options: {
  startDate?: Date;
  endDate?: Date;
  reportStaffId?: number;
  country?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  
  if (options.startDate) {
    conditions.push(sql`${reports.reportDate} >= ${options.startDate}`);
  }
  if (options.endDate) {
    conditions.push(sql`${reports.reportDate} <= ${options.endDate}`);
  }
  if (options.reportStaffId) {
    conditions.push(eq(reports.reportStaffId, options.reportStaffId));
  }
  if (options.country) {
    conditions.push(eq(reportStaff.country, options.country));
  }

  const query = db
    .select({
      report: reports,
      staff: reportStaff,
    })
    .from(reports)
    .leftJoin(reportStaff, eq(reports.reportStaffId, reportStaff.id));

  if (conditions.length > 0) {
    return await query.where(and(...conditions)).orderBy(desc(reports.reportDate));
  }

  return await query.orderBy(desc(reports.reportDate));
}


// ========== Brand Management Functions ==========

// Create a new brand
export async function createBrand(brandData: InsertBrand) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brands).values(brandData);
  const insertId = Number((result as any)[0]?.insertId || (result as any).insertId || 0);
  
  // Return the created brand with id and name
  return {
    id: insertId,
    brandName: brandData.name,
  };
}

// Get all brands with optional filters and GMV totals
export async function getAllBrands(filters?: { status?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(brands);
  
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(brands.status, filters.status as any));
  }
  if (filters?.search) {
    conditions.push(like(brands.name, `%${filters.search}%`));
  }
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  
  const brandsResult = await query.orderBy(desc(brands.updatedAt));
  
  // Get GMV totals and contract totals for each brand
  const brandsWithStats = await Promise.all(
    brandsResult.map(async (brand) => {
      // Get GMV from livestreams
      const livestreams = await db
        .select({ gmv: brandLivestreams.gmv })
        .from(brandLivestreams)
        .where(eq(brandLivestreams.brandId, brand.id));
      
      const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
      
      // Get total contract amount (fixedFee) from contracts
      const contracts = await db
        .select({ fixedFee: brandContracts.fixedFee })
        .from(brandContracts)
        .where(eq(brandContracts.brandId, brand.id));
      
      const totalAdBudget = contracts.reduce((sum, c) => sum + (c.fixedFee || 0), 0);
      
      return {
        ...brand,
        totalGmv,
        totalAdBudget,
      };
    })
  );
  
  return brandsWithStats;
}

// Get brand by ID
export async function getBrandById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Update brand
export async function updateBrand(id: number, brandData: Partial<InsertBrand>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brands).set(brandData).where(eq(brands.id, id));
  return await getBrandById(id);
}

// Delete brand
export async function deleteBrand(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related products and activities first
  await db.delete(brandProducts).where(eq(brandProducts.brandId, id));
  await db.delete(brandActivities).where(eq(brandActivities.brandId, id));
  await db.delete(brands).where(eq(brands.id, id));
}

// ========== Brand Products Functions ==========

// Create a new product
export async function createBrandProduct(productData: InsertBrandProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandProducts).values(productData);
  return { id: Number(result[0].insertId), ...productData };
}

// Get all products (for statistics)
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID
export async function getProductsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.createdAt));
}

// Get products by brand ID with GMV from linked livestreams
export async function getProductsByBrandIdWithGmv(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all products for the brand
  const products = await db.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.createdAt));
  
  // Get all livestreams for the brand that have a productId
  const livestreams = await db.select().from(brandLivestreams).where(
    and(
      eq(brandLivestreams.brandId, brandId),
      isNotNull(brandLivestreams.productId)
    )
  );
  
  // Calculate GMV for each product
  const productGmvMap = new Map<number, number>();
  for (const ls of livestreams) {
    if (ls.productId && ls.gmv) {
      const currentGmv = productGmvMap.get(ls.productId) || 0;
      productGmvMap.set(ls.productId, currentGmv + Number(ls.gmv));
    }
  }
  
  // Add GMV to each product
  return products.map(product => ({
    ...product,
    totalGmv: productGmvMap.get(product.id) || 0,
  }));
}

// Get product by ID
export async function getBrandProductById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(brandProducts).where(eq(brandProducts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Update product
export async function updateBrandProduct(id: number, productData: Partial<InsertBrandProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandProducts).set(productData).where(eq(brandProducts.id, id));
}

// Delete product
export async function deleteBrandProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandProducts).where(eq(brandProducts.id, id));
}

// ========== Brand Activities Functions ==========

// Create a new activity
export async function createBrandActivity(activityData: InsertBrandActivity) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandActivities).values(activityData);
  return result;
}

// Get activities by brand ID
export async function getActivitiesByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandActivities).where(eq(brandActivities.brandId, brandId)).orderBy(desc(brandActivities.activityDate));
}

// Update activity
export async function updateBrandActivity(id: number, activityData: Partial<InsertBrandActivity>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandActivities).set(activityData).where(eq(brandActivities.id, id));
}

// Delete activity
export async function deleteBrandActivity(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandActivities).where(eq(brandActivities.id, id));
}

// Get brand statistics
export async function getBrandStatistics() {
  const db = await getDb();
  if (!db) return { total: 0, byStatus: {} };
  
  const allBrands = await db.select().from(brands);
  
  const byStatus: Record<string, number> = {};
  allBrands.forEach(brand => {
    byStatus[brand.status] = (byStatus[brand.status] || 0) + 1;
  });
  
  return {
    total: allBrands.length,
    byStatus,
  };
}


// ========== Brand Livestream Functions ==========

// Create a new livestream record
export async function createBrandLivestream(livestreamData: InsertBrandLivestream) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandLivestreams).values(livestreamData);
  // 作成したIDを取得
  const insertId = (result as any)[0]?.insertId;
  return { id: insertId, ...livestreamData };
}

// Get livestreams by brand ID with product GMV totals
export async function getLivestreamsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const livestreams = await db.select().from(brandLivestreams).where(eq(brandLivestreams.brandId, brandId)).orderBy(desc(brandLivestreams.livestreamDate));
  
  // 各直播の商品別GMV合計を取得
  const livestreamsWithGmv = await Promise.all(
    livestreams.map(async (ls) => {
      const products = await db
        .select()
        .from(livestreamProducts)
        .where(eq(livestreamProducts.livestreamId, ls.id));
      
      const productGmvTotal = products.reduce((sum, p) => sum + (p.gmv || 0), 0);
      const productCount = products.length;
      
      return {
        ...ls,
        productGmvTotal,
        productCount,
      };
    })
  );
  
  return livestreamsWithGmv;
}

// Update livestream
export async function updateBrandLivestream(id: number, livestreamData: Partial<InsertBrandLivestream>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandLivestreams).set(livestreamData).where(eq(brandLivestreams.id, id));
}

// Delete livestream
export async function deleteBrandLivestream(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandLivestreams).where(eq(brandLivestreams.id, id));
}

// Get all livestreams (for statistics)
export async function getAllLivestreams() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandLivestreams).orderBy(desc(brandLivestreams.livestreamDate));
}

// Get livestream statistics for a brand
export async function getLivestreamStatsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return { totalSales: 0, totalStreams: 0, avgSales: 0 };
  
  const livestreams = await db.select().from(brandLivestreams).where(eq(brandLivestreams.brandId, brandId));
  
  const totalSales = livestreams.reduce((sum, ls) => sum + (ls.salesAmount || 0), 0);
  const totalStreams = livestreams.length;
  const avgSales = totalStreams > 0 ? Math.round(totalSales / totalStreams) : 0;
  
  return { totalSales, totalStreams, avgSales };
}


// ========== Report Followup Functions ==========

// Create a new followup item
export async function createReportFollowup(followupData: InsertReportFollowup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [inserted] = await db.insert(reportFollowups).values(followupData).$returningId();
  if (inserted && inserted.id) {
    const result = await db.select().from(reportFollowups).where(eq(reportFollowups.id, inserted.id)).limit(1);
    return result.length > 0 ? result[0] : null;
  }
  return null;
}

// Get all pending followups with optional staff filter
export async function getPendingFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(reportFollowups.status, "pending")];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(asc(reportFollowups.dueDate));
}

// Get overdue followups (due date passed and still pending) with optional staff filter
export async function getOverdueFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const conditions = [
    eq(reportFollowups.status, "pending"),
    sql`${reportFollowups.dueDate} < ${now}`
  ];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(asc(reportFollowups.dueDate));
}

// Update followup status
export async function updateFollowupStatus(
  id: number, 
  status: "pending" | "completed" | "cancelled", 
  resultCategory?: "成約" | "継続" | "保留" | "失注" | "完了",
  resultNote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
    if (resultCategory) {
      updateData.resultCategory = resultCategory;
    }
    if (resultNote) {
      updateData.resultNote = resultNote;
      updateData.completedNote = resultNote; // 後方互換
    }
  }
  
  await db.update(reportFollowups).set(updateData).where(eq(reportFollowups.id, id));
}

// Get completed followups
export async function getCompletedFollowups(staffId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(reportFollowups.status, "completed")];
  if (staffId) {
    conditions.push(eq(reportFollowups.reportStaffId, staffId));
  }
  
  return await db
    .select({
      followup: reportFollowups,
      staff: reportStaff,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reportStaff, eq(reportFollowups.reportStaffId, reportStaff.id))
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(and(...conditions))
    .orderBy(desc(reportFollowups.completedAt))
    .limit(50);
}

// Get followup by ID
export async function getFollowupById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(reportFollowups).where(eq(reportFollowups.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Link next action to current followup
export async function linkNextAction(currentId: number, nextActionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(reportFollowups).set({ nextActionId }).where(eq(reportFollowups.id, currentId));
}

// Get followups by report ID
export async function getFollowupsByReportId(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(reportFollowups).where(eq(reportFollowups.reportId, reportId)).orderBy(desc(reportFollowups.createdAt));
}

// Get followups by staff ID
export async function getFollowupsByStaffId(reportStaffId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      followup: reportFollowups,
      report: reports,
    })
    .from(reportFollowups)
    .leftJoin(reports, eq(reportFollowups.reportId, reports.id))
    .where(eq(reportFollowups.reportStaffId, reportStaffId))
    .orderBy(desc(reportFollowups.createdAt));
}

// Delete followup
export async function deleteReportFollowup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(reportFollowups).where(eq(reportFollowups.id, id));
}

// Check if followup already exists for a report and extracted item
export async function checkExistingFollowup(reportId: number, extractedItem: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(reportFollowups)
    .where(
      and(
        eq(reportFollowups.reportId, reportId),
        eq(reportFollowups.extractedItem, extractedItem)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


// ============================================
// Business Card Management Functions
// ============================================

// Create a new business card
export async function createBusinessCard(data: InsertBusinessCard) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(businessCards).values(data);
  return result;
}

// Get business card by ID
export async function getBusinessCardById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(businessCards).where(eq(businessCards.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Get all business cards with optional filters
export async function getBusinessCards(options?: {
  registeredBy?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  
  if (options?.registeredBy) {
    conditions.push(eq(businessCards.registeredBy, options.registeredBy));
  }
  
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    conditions.push(
      or(
        like(businessCards.name, searchTerm),
        like(businessCards.company, searchTerm),
        like(businessCards.email, searchTerm),
        like(businessCards.phone, searchTerm)
      )
    );
  }
  
  let query = db.select().from(businessCards);
  
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }
  
  return await query
    .orderBy(desc(businessCards.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

// Check for duplicate business card by company + name hash
export async function checkDuplicateBusinessCard(duplicateHash: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(businessCards)
    .where(eq(businessCards.duplicateHash, duplicateHash))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Update business card
export async function updateBusinessCard(id: number, data: Partial<InsertBusinessCard>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(businessCards).set(data).where(eq(businessCards.id, id));
}

// Delete business card
export async function deleteBusinessCard(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(businessCards).where(eq(businessCards.id, id));
}

// Get business card count
export async function getBusinessCardCount(registeredBy?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query = db.select({ count: sql<number>`count(*)` }).from(businessCards);
  
  if (registeredBy) {
    query = query.where(eq(businessCards.registeredBy, registeredBy)) as typeof query;
  }
  
  const result = await query;
  return result[0]?.count || 0;
}


// ===== Brand LCJ Staff Management =====

// Get LCJ staff assigned to a brand
export async function getBrandLcjStaff(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select({
      id: brandLcjStaff.id,
      brandId: brandLcjStaff.brandId,
      reportStaffId: brandLcjStaff.reportStaffId,
      assignedAt: brandLcjStaff.assignedAt,
      staffName: reportStaff.name,
      staffCountry: reportStaff.country,
    })
    .from(brandLcjStaff)
    .leftJoin(reportStaff, eq(brandLcjStaff.reportStaffId, reportStaff.id))
    .where(eq(brandLcjStaff.brandId, brandId))
    .orderBy(asc(brandLcjStaff.assignedAt));
}

// Assign LCJ staff to a brand
export async function assignLcjStaffToBrand(brandId: number, reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if already assigned
  const existing = await db
    .select()
    .from(brandLcjStaff)
    .where(and(
      eq(brandLcjStaff.brandId, brandId),
      eq(brandLcjStaff.reportStaffId, reportStaffId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const [inserted] = await db.insert(brandLcjStaff).values({
    brandId,
    reportStaffId,
  }).$returningId();
  
  return inserted;
}

// Remove LCJ staff from a brand
export async function removeLcjStaffFromBrand(brandId: number, reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandLcjStaff).where(and(
    eq(brandLcjStaff.brandId, brandId),
    eq(brandLcjStaff.reportStaffId, reportStaffId)
  ));
}

// Set LCJ staff for a brand (replace all)
export async function setBrandLcjStaff(brandId: number, reportStaffIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Remove all existing assignments
  await db.delete(brandLcjStaff).where(eq(brandLcjStaff.brandId, brandId));
  
  // Add new assignments
  if (reportStaffIds.length > 0) {
    await db.insert(brandLcjStaff).values(
      reportStaffIds.map(reportStaffId => ({
        brandId,
        reportStaffId,
      }))
    );
  }
}

// Get brands by LCJ staff
export async function getBrandsByLcjStaff(reportStaffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const brandIds = await db
    .select({ brandId: brandLcjStaff.brandId })
    .from(brandLcjStaff)
    .where(eq(brandLcjStaff.reportStaffId, reportStaffId));
  
  if (brandIds.length === 0) return [];
  
  return await db
    .select()
    .from(brands)
    .where(inArray(brands.id, brandIds.map(b => b.brandId)))
    .orderBy(desc(brands.updatedAt));
}


// ============================================
// Activity Log Functions
// ============================================

// Create a new activity log
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(activityLogs).values(data);
  return result;
}

// Get recent activity logs
export async function getRecentActivityLogs(limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      log: activityLogs,
      user: users,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// Get activity logs by user
export async function getActivityLogsByUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select({
      log: activityLogs,
      user: users,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

// Get all registered users (excluding test users with @example.com)
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(users)
    .where(not(like(users.email, '%@example.com')))
    .orderBy(desc(users.createdAt));
}

// Get user activity statistics (excluding test users with @example.com)
export async function getUserActivityStats() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all users (excluding test users)
  const allUsers = await db.select().from(users)
    .where(not(like(users.email, '%@example.com')))
    .orderBy(desc(users.createdAt));
  
  // Get activity counts per user
  const activityCounts = await db
    .select({
      userId: activityLogs.userId,
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(activityLogs)
    .groupBy(activityLogs.userId);
  
  // Combine data
  const countMap = new Map(activityCounts.map(a => [a.userId, a.count]));
  
  return allUsers.map(user => ({
    user,
    activityCount: countMap.get(user.id) || 0,
  }));
}


// ============================================
// Brand Contract Functions
// ============================================

// Create a new brand contract
export async function createBrandContract(data: InsertBrandContract) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandContracts).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get contracts by brand ID
export async function getContractsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandContracts)
    .where(eq(brandContracts.brandId, brandId))
    .orderBy(desc(brandContracts.createdAt));
}

// Get contract by ID
export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(brandContracts)
    .where(eq(brandContracts.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Update a brand contract
export async function updateBrandContract(id: number, data: Partial<InsertBrandContract>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(brandContracts).set(data).where(eq(brandContracts.id, id));
}

// Delete a brand contract (and all related livestream links)
export async function deleteBrandContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First, delete all related livestream links
  await deleteAllContractLivestreamLinks(id);
  
  // Then delete the contract itself
  await db.delete(brandContracts).where(eq(brandContracts.id, id));
}

// Get all contracts (for statistics)
export async function getAllContracts() {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandContracts).orderBy(desc(brandContracts.createdAt));
}

// Get active contracts count by brand ID
export async function getActiveContractsCount(brandId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(brandContracts)
    .where(and(
      eq(brandContracts.brandId, brandId),
      eq(brandContracts.status, "契約中")
    ));
  
  return result[0]?.count || 0;
}


// ==========================================
// AI Advice Functions
// ==========================================

// Create AI advice for a report
export async function createReportAiAdvice(data: InsertReportAiAdvice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reportAiAdvice).values(data);
  const insertId = result[0].insertId;
  return { id: insertId, ...data };
}

// Get AI advice by report ID
export async function getAiAdviceByReportId(reportId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(reportAiAdvice)
    .where(eq(reportAiAdvice.reportId, reportId))
    .orderBy(desc(reportAiAdvice.createdAt));
}

// Get AI advice by ID
export async function getAiAdviceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(reportAiAdvice)
    .where(eq(reportAiAdvice.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// ==========================================
// AI Advice Feedback Functions
// ==========================================

// Create feedback for AI advice
export async function createAiAdviceFeedback(data: InsertAiAdviceFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(aiAdviceFeedback).values(data);
}

// Get feedback by advice ID
export async function getFeedbackByAdviceId(adviceId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiAdviceFeedback)
    .where(eq(aiAdviceFeedback.adviceId, adviceId))
    .orderBy(desc(aiAdviceFeedback.createdAt));
}

// Check if user already gave feedback for an advice
export async function getUserFeedbackForAdvice(adviceId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(aiAdviceFeedback)
    .where(and(
      eq(aiAdviceFeedback.adviceId, adviceId),
      eq(aiAdviceFeedback.userId, userId)
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Update existing feedback
export async function updateAiAdviceFeedback(id: number, data: Partial<InsertAiAdviceFeedback>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(aiAdviceFeedback).set(data).where(eq(aiAdviceFeedback.id, id));
}

// ==========================================
// AI Learning Examples Functions
// ==========================================

// Create or update learning example
export async function upsertAiLearningExample(data: {
  reportContent: string;
  adviceText: string;
  isGoodExample: "yes" | "no";
  category?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if similar example exists
  const existing = await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.adviceText, data.adviceText),
      eq(aiLearningExamples.reportContent, data.reportContent)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing
    const example = existing[0];
    const newGoodCount = data.isGoodExample === "yes" ? example.goodCount + 1 : example.goodCount;
    const newBadCount = data.isGoodExample === "no" ? example.badCount + 1 : example.badCount;
    const newIsGoodExample = newGoodCount >= newBadCount ? "yes" : "no";
    
    await db.update(aiLearningExamples)
      .set({
        feedbackCount: example.feedbackCount + 1,
        goodCount: newGoodCount,
        badCount: newBadCount,
        isGoodExample: newIsGoodExample as "yes" | "no",
      })
      .where(eq(aiLearningExamples.id, example.id));
  } else {
    // Create new
    await db.insert(aiLearningExamples).values({
      reportContent: data.reportContent,
      adviceText: data.adviceText,
      isGoodExample: data.isGoodExample,
      feedbackCount: 1,
      goodCount: data.isGoodExample === "yes" ? 1 : 0,
      badCount: data.isGoodExample === "no" ? 1 : 0,
      category: data.category,
    });
  }
}

// Get good learning examples for AI prompt
export async function getGoodLearningExamples(limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.isGoodExample, "yes"),
      sql`${aiLearningExamples.goodCount} >= 2` // At least 2 good ratings
    ))
    .orderBy(desc(aiLearningExamples.goodCount))
    .limit(limit);
}

// Get bad learning examples to avoid
export async function getBadLearningExamples(limit: number = 3) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiLearningExamples)
    .where(and(
      eq(aiLearningExamples.isGoodExample, "no"),
      sql`${aiLearningExamples.badCount} >= 2` // At least 2 bad ratings
    ))
    .orderBy(desc(aiLearningExamples.badCount))
    .limit(limit);
}

// Get feedback statistics
export async function getAiFeedbackStats() {
  const db = await getDb();
  if (!db) return { totalFeedback: 0, goodCount: 0, badCount: 0 };
  
  const result = await db
    .select({
      totalFeedback: sql<number>`COUNT(*)`.as('totalFeedback'),
      goodCount: sql<number>`SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END)`.as('goodCount'),
      badCount: sql<number>`SUM(CASE WHEN rating = 'bad' THEN 1 ELSE 0 END)`.as('badCount'),
    })
    .from(aiAdviceFeedback);
  
  return result[0] || { totalFeedback: 0, goodCount: 0, badCount: 0 };
}



// ==========================================
// Chat Report Session Functions
// ==========================================

// Create a new chat report session
export async function createChatReportSession(data: InsertChatReportSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatReportSessions).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get chat session by ID
export async function getChatSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(chatReportSessions)
    .where(eq(chatReportSessions.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Get today's chat session for a staff
export async function getTodayChatSession(staffId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const result = await db
    .select()
    .from(chatReportSessions)
    .where(and(
      eq(chatReportSessions.staffId, staffId),
      sql`${chatReportSessions.reportDate} >= ${today}`,
      sql`${chatReportSessions.reportDate} < ${tomorrow}`
    ))
    .orderBy(desc(chatReportSessions.createdAt))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

// Get chat sessions by staff ID
export async function getChatSessionsByStaffId(staffId: number, limit: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportSessions)
    .where(eq(chatReportSessions.staffId, staffId))
    .orderBy(desc(chatReportSessions.reportDate))
    .limit(limit);
}

// Update chat session status
export async function updateChatSessionStatus(
  id: number, 
  status: "in_progress" | "completed" | "converted",
  convertedReportId?: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { status };
  if (convertedReportId) {
    updateData.convertedReportId = convertedReportId;
  }
  
  await db.update(chatReportSessions).set(updateData).where(eq(chatReportSessions.id, id));
}

// ==========================================
// Chat Report Message Functions
// ==========================================

// Add a message to chat session
export async function addChatMessage(data: InsertChatReportMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(chatReportMessages).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get messages by session ID
export async function getMessagesBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportMessages)
    .where(eq(chatReportMessages.sessionId, sessionId))
    .orderBy(asc(chatReportMessages.createdAt));
}

// Get user messages from session (for report conversion)
export async function getUserMessagesFromSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(chatReportMessages)
    .where(and(
      eq(chatReportMessages.sessionId, sessionId),
      eq(chatReportMessages.role, "user")
    ))
    .orderBy(asc(chatReportMessages.createdAt));
}

// ==========================================
// Staff AI Profile Functions
// ==========================================

// Get or create staff AI profile
export async function getOrCreateStaffAiProfile(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Try to get existing profile
  const existing = await db
    .select()
    .from(staffAiProfiles)
    .where(eq(staffAiProfiles.staffId, staffId))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  // Create new profile
  const result = await db.insert(staffAiProfiles).values({
    staffId,
    preferredQuestionStyle: "simple",
    strongAreas: [],
    improvementAreas: [],
    commonPatterns: {},
    totalReports: 0,
    totalChatSessions: 0,
    avgResponseLength: 0,
    goodFeedbackCount: 0,
    badFeedbackCount: 0,
  });
  
  const insertId = Number(result[0].insertId);
  const newProfile = await db
    .select()
    .from(staffAiProfiles)
    .where(eq(staffAiProfiles.id, insertId))
    .limit(1);
  
  return newProfile[0];
}

// Update staff AI profile
export async function updateStaffAiProfile(staffId: number, data: Partial<InsertStaffAiProfile>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(staffAiProfiles).set(data).where(eq(staffAiProfiles.staffId, staffId));
}

// Increment staff chat session count
export async function incrementStaffChatCount(staffId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const profile = await getOrCreateStaffAiProfile(staffId);
  await db.update(staffAiProfiles)
    .set({ totalChatSessions: profile.totalChatSessions + 1 })
    .where(eq(staffAiProfiles.staffId, staffId));
}

// Update staff feedback counts
export async function updateStaffFeedbackCounts(staffId: number, isGood: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const profile = await getOrCreateStaffAiProfile(staffId);
  if (isGood) {
    await db.update(staffAiProfiles)
      .set({ goodFeedbackCount: profile.goodFeedbackCount + 1 })
      .where(eq(staffAiProfiles.staffId, staffId));
  } else {
    await db.update(staffAiProfiles)
      .set({ badFeedbackCount: profile.badFeedbackCount + 1 })
      .where(eq(staffAiProfiles.staffId, staffId));
  }
}

// ==========================================
// AI Question Template Functions
// ==========================================

// Get question templates for a specific day
export async function getQuestionTemplatesForDay(dayOfWeek: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiQuestionTemplates)
    .where(and(
      eq(aiQuestionTemplates.isActive, true),
      or(
        eq(aiQuestionTemplates.dayOfWeek, dayOfWeek),
        sql`${aiQuestionTemplates.dayOfWeek} IS NULL`
      )
    ))
    .orderBy(desc(aiQuestionTemplates.priority));
}

// Get all active question templates
export async function getAllActiveQuestionTemplates() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.isActive, true))
    .orderBy(desc(aiQuestionTemplates.priority));
}

// Create question template
export async function createQuestionTemplate(data: InsertAiQuestionTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(aiQuestionTemplates).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Update question template usage count
export async function incrementQuestionUsage(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const template = await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.id, id))
    .limit(1);
  
  if (template.length > 0) {
    await db.update(aiQuestionTemplates)
      .set({ usageCount: template[0].usageCount + 1 })
      .where(eq(aiQuestionTemplates.id, id));
  }
}

// Update question template feedback
export async function updateQuestionFeedback(id: number, isGood: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const template = await db
    .select()
    .from(aiQuestionTemplates)
    .where(eq(aiQuestionTemplates.id, id))
    .limit(1);
  
  if (template.length > 0) {
    if (isGood) {
      await db.update(aiQuestionTemplates)
        .set({ goodFeedbackCount: template[0].goodFeedbackCount + 1 })
        .where(eq(aiQuestionTemplates.id, id));
    } else {
      await db.update(aiQuestionTemplates)
        .set({ badFeedbackCount: template[0].badFeedbackCount + 1 })
        .where(eq(aiQuestionTemplates.id, id));
    }
  }
}

// Get past reports for a staff (for context)
export async function getRecentReportsByStaffId(staffId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(reports)
    .where(eq(reports.reportStaffId, staffId))
    .orderBy(desc(reports.reportDate))
    .limit(limit);
}


// ============================================
// LINE Bot Database Functions
// ============================================

// Create or update LINE user
export async function createOrUpdateLineUser(data: {
  lineUserId: string;
  displayName?: string;
  pictureUrl?: string;
  statusMessage?: string;
  brandId?: number;
  staffId?: number;
  liverId?: number;
  userType?: "customer" | "staff" | "liver" | "unknown";
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if user exists
  const existing = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, data.lineUserId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing user
    await db
      .update(lineUsers)
      .set({
        displayName: data.displayName ?? existing[0].displayName,
        pictureUrl: data.pictureUrl ?? existing[0].pictureUrl,
        statusMessage: data.statusMessage ?? existing[0].statusMessage,
        brandId: data.brandId ?? existing[0].brandId,
        staffId: data.staffId ?? existing[0].staffId,
        liverId: data.liverId ?? existing[0].liverId,
        userType: data.userType ?? existing[0].userType,
      })
      .where(eq(lineUsers.lineUserId, data.lineUserId));
    return existing[0];
  } else {
    // Create new user
    const result = await db.insert(lineUsers).values({
      lineUserId: data.lineUserId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl,
      statusMessage: data.statusMessage,
      brandId: data.brandId,
      staffId: data.staffId,
      liverId: data.liverId,
      userType: data.userType ?? "unknown",
    });
    return { id: result[0].insertId, ...data };
  }
}

// Update LINE user blocked status
export async function updateLineUserBlocked(lineUserId: string, isBlocked: boolean) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineUsers)
    .set({ isBlocked })
    .where(eq(lineUsers.lineUserId, lineUserId));
}

// Update LINE user last message time
export async function updateLineUserLastMessage(lineUserId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineUsers)
    .set({ lastMessageAt: new Date() })
    .where(eq(lineUsers.lineUserId, lineUserId));
}

// Get LINE user by LINE user ID
export async function getLineUserByLineId(lineUserId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.lineUserId, lineUserId))
    .limit(1);
  
  return result[0] || null;
}

// Get all LINE users
export async function getAllLineUsers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineUsers)
    .orderBy(desc(lineUsers.lastMessageAt));
}

// Get LINE users linked to livers with liver details
export async function getLineUsersWithLiverDetails() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: lineUsers.id,
      lineUserId: lineUsers.lineUserId,
      displayName: lineUsers.displayName,
      pictureUrl: lineUsers.pictureUrl,
      userType: lineUsers.userType,
      isBlocked: lineUsers.isBlocked,
      brandId: lineUsers.brandId,
      liverId: lineUsers.liverId,
      lastMessageAt: lineUsers.lastMessageAt,
      createdAt: lineUsers.createdAt,
      // Liver details
      liverName: livers.name,
      liverEmail: livers.email,
      liverAvatarUrl: livers.avatarUrl,
      liverTiktokAccount: livers.tiktokAccount,
      liverInstagramAccount: livers.instagramAccount,
      liverIsActive: livers.isActive,
    })
    .from(lineUsers)
    .innerJoin(livers, eq(lineUsers.liverId, livers.id))
    .orderBy(desc(lineUsers.lastMessageAt));
  
  return result;
}

// Get liver interaction summary (messages, livestreams, etc.)
export async function getLiverInteractionSummary(liverId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get liver info
  const liver = await db
    .select()
    .from(livers)
    .where(eq(livers.id, liverId))
    .limit(1);
  
  if (liver.length === 0) return null;
  
  // Get LINE user linked to this liver
  const lineUser = await db
    .select()
    .from(lineUsers)
    .where(eq(lineUsers.liverId, liverId))
    .limit(1);
  
  // Get message count
  let messageCount = 0;
  if (lineUser.length > 0) {
    const messages = await db
      .select({ count: sql<number>`count(*)` })
      .from(lineMessages)
      .where(eq(lineMessages.lineUserId, lineUser[0].lineUserId));
    messageCount = messages[0]?.count || 0;
  }
  
  // Get recent messages
  let recentMessages: any[] = [];
  if (lineUser.length > 0) {
    recentMessages = await db
      .select()
      .from(lineMessages)
      .where(eq(lineMessages.lineUserId, lineUser[0].lineUserId))
      .orderBy(desc(lineMessages.createdAt))
      .limit(20);
  }
  
  // Get livestream count
  const livestreams = await db
    .select({ count: sql<number>`count(*)` })
    .from(brandLivestreams)
    .where(eq(brandLivestreams.liverId, liverId));
  const livestreamCount = livestreams[0]?.count || 0;
  
  // Get recent livestreams with AI advice
  const recentLivestreams = await db
    .select({
      id: brandLivestreams.id,
      livestreamDate: brandLivestreams.livestreamDate,
      salesAmount: brandLivestreams.salesAmount,
      gmv: brandLivestreams.gmv,
      aiAdvice: brandLivestreams.aiAdvice,
      aiStructuredAdvice: brandLivestreams.aiStructuredAdvice,
      result: brandLivestreams.result,
    })
    .from(brandLivestreams)
    .where(eq(brandLivestreams.liverId, liverId))
    .orderBy(desc(brandLivestreams.livestreamDate))
    .limit(5);
  
  return {
    liver: liver[0],
    lineUser: lineUser[0] || null,
    messageCount,
    recentMessages,
    livestreamCount,
    recentLivestreams,
  };
}

// Create or update LINE group
export async function createOrUpdateLineGroup(data: {
  lineGroupId: string;
  groupName?: string;
  pictureUrl?: string;
  brandId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  
  // Check if group exists
  const existing = await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.lineGroupId, data.lineGroupId))
    .limit(1);
  
  if (existing.length > 0) {
    // Update existing group
    await db
      .update(lineGroups)
      .set({
        groupName: data.groupName ?? existing[0].groupName,
        pictureUrl: data.pictureUrl ?? existing[0].pictureUrl,
        brandId: data.brandId ?? existing[0].brandId,
      })
      .where(eq(lineGroups.lineGroupId, data.lineGroupId));
    return existing[0];
  } else {
    // Create new group with auto follow-up enabled by default
    const result = await db.insert(lineGroups).values({
      lineGroupId: data.lineGroupId,
      groupName: data.groupName,
      pictureUrl: data.pictureUrl,
      brandId: data.brandId,
      autoFollowUpEnabled: true, // Enable auto follow-up by default
      autoFollowUpDays: 2, // Default to 2 days
      lastMessageAt: new Date(), // Set initial lastMessageAt to now
    });
    return { id: result[0].insertId, ...data, autoFollowUpEnabled: true, autoFollowUpDays: 2 };
  }
}

// Update LINE group active status
export async function updateLineGroupActive(lineGroupId: string, isActive: boolean) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ isActive })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Get LINE group by LINE group ID
export async function getLineGroupByLineId(lineGroupId: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.lineGroupId, lineGroupId))
    .limit(1);
  
  return result[0] || null;
}

// Get all LINE groups
export async function getAllLineGroups() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineGroups)
    .where(eq(lineGroups.isActive, true))
    .orderBy(desc(lineGroups.lastMessageAt));
}

// Update LINE group auto follow-up settings
export async function updateLineGroupAutoFollowUp(lineGroupId: string, settings: {
  autoFollowUpEnabled?: boolean;
  autoFollowUpDays?: number;
  autoFollowUpMessage?: string;
}) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set(settings)
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Get groups that need auto follow-up (inactive for X days)
export async function getGroupsNeedingFollowUp() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all active groups with auto follow-up enabled
  const groups = await db
    .select()
    .from(lineGroups)
    .where(
      and(
        eq(lineGroups.isActive, true),
        eq(lineGroups.autoFollowUpEnabled, true)
      )
    );
  
  // Get all active LINE follow-ups (reminders) for groups
  const activeFollowUps = await db
    .select()
    .from(lineFollowUps)
    .where(
      and(
        eq(lineFollowUps.status, "active"),
        isNotNull(lineFollowUps.lineGroupId)
      )
    );
  
  // Create a set of group IDs that have active reminders
  const groupsWithActiveReminders = new Set(
    activeFollowUps.map(f => f.lineGroupId).filter(Boolean)
  );
  
  const now = new Date();
  const groupsNeedingFollowUp = [];
  
  for (const group of groups) {
    // Skip if this group has an active reminder set
    if (groupsWithActiveReminders.has(group.lineGroupId)) {
      console.log(`[Group Follow-Up] Skipping group ${group.groupName || group.lineGroupId}: has active reminder`);
      continue;
    }
    
    const inactiveDays = group.autoFollowUpDays || 2;
    const lastActivity = group.lastMessageAt || group.createdAt;
    const lastFollowUp = group.lastAutoFollowUpAt;
    
    // Calculate days since last message
    const daysSinceLastMessage = Math.floor(
      (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Check if we need to send follow-up
    if (daysSinceLastMessage >= inactiveDays) {
      // Don't send if we already sent a follow-up recently (within the same inactive period)
      if (!lastFollowUp || new Date(lastFollowUp) < new Date(lastActivity)) {
        groupsNeedingFollowUp.push({
          ...group,
          daysSinceLastMessage,
        });
      }
    }
  }
  
  return groupsNeedingFollowUp;
}

// Update last auto follow-up timestamp
export async function updateGroupLastAutoFollowUp(lineGroupId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ lastAutoFollowUpAt: new Date() })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Update group last message timestamp
export async function updateGroupLastMessageAt(lineGroupId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineGroups)
    .set({ lastMessageAt: new Date() })
    .where(eq(lineGroups.lineGroupId, lineGroupId));
}

// Save LINE message
export async function saveLineMessage(data: {
  messageId: string;
  sourceType: "user" | "group" | "room";
  lineUserId?: string;
  lineGroupId?: string;
  senderName?: string;
  messageType: string;
  content?: string;
  direction: "incoming" | "outgoing";
  lineTimestamp?: number;
  // Response tracking fields
  needsResponse?: boolean;
  responseStatus?: "none" | "pending" | "responded" | "cancelled";
  responseSummary?: string;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(lineMessages).values({
    messageId: data.messageId,
    sourceType: data.sourceType,
    lineUserId: data.lineUserId,
    lineGroupId: data.lineGroupId,
    senderName: data.senderName,
    messageType: data.messageType,
    content: data.content,
    direction: data.direction,
    lineTimestamp: data.lineTimestamp,
    needsResponse: data.needsResponse || false,
    responseStatus: data.responseStatus || "none",
    responseSummary: data.responseSummary,
  });
  
  return { id: result[0].insertId, ...data };
}

// Get LINE messages for a user or group
export async function getLineMessages(options: {
  lineUserId?: string;
  lineGroupId?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select().from(lineMessages);
  
  if (options.lineUserId) {
    query = query.where(eq(lineMessages.lineUserId, options.lineUserId)) as typeof query;
  } else if (options.lineGroupId) {
    query = query.where(eq(lineMessages.lineGroupId, options.lineGroupId)) as typeof query;
  }
  
  return await query
    .orderBy(desc(lineMessages.createdAt))
    .limit(options.limit || 50);
}

// Create LINE follow-up
export async function createLineFollowUp(data: {
  targetType: "user" | "group";
  lineUserId?: string;
  lineGroupId?: string;
  triggerCondition: "no_reply" | "scheduled" | "event";
  delayHours?: number;
  maxAttempts?: number;
  messageTemplate: string;
  brandId?: number;
  createdBy?: number;
  nextScheduledAt?: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(lineFollowUps).values({
    targetType: data.targetType,
    lineUserId: data.lineUserId,
    lineGroupId: data.lineGroupId,
    triggerCondition: data.triggerCondition,
    delayHours: data.delayHours ?? 72,
    maxAttempts: data.maxAttempts ?? 3,
    messageTemplate: data.messageTemplate,
    brandId: data.brandId,
    createdBy: data.createdBy,
    nextScheduledAt: data.nextScheduledAt,
  });
  
  return { id: result[0].insertId, ...data };
}

// Get active LINE follow-ups
export async function getActiveLineFollowUps() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .where(eq(lineFollowUps.status, "active"))
    .orderBy(lineFollowUps.nextScheduledAt);
}

// Update LINE follow-up status
export async function updateLineFollowUpStatus(
  id: number,
  status: "active" | "completed" | "cancelled",
  lastSentAt?: Date,
  nextScheduledAt?: Date,
  incrementAttempts?: boolean
) {
  const db = await getDb();
  if (!db) return;
  
  const updateData: Record<string, unknown> = { status };
  if (lastSentAt) updateData.lastSentAt = lastSentAt;
  if (nextScheduledAt) updateData.nextScheduledAt = nextScheduledAt;
  if (incrementAttempts) {
    const current = await db.select().from(lineFollowUps).where(eq(lineFollowUps.id, id)).limit(1);
    if (current.length > 0) {
      updateData.currentAttempts = current[0].currentAttempts + 1;
    }
  }
  
  await db
    .update(lineFollowUps)
    .set(updateData)
    .where(eq(lineFollowUps.id, id));
}


// Get all LINE follow-ups
export async function getAllLineFollowUps() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .orderBy(desc(lineFollowUps.createdAt));
}

// Get LINE follow-ups by user
export async function getLineFollowUpsByUser(lineUserId: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineFollowUps)
    .where(eq(lineFollowUps.lineUserId, lineUserId))
    .orderBy(desc(lineFollowUps.createdAt));
}

// Delete LINE follow-up
export async function deleteLineFollowUp(id: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(lineFollowUps).where(eq(lineFollowUps.id, id));
}


// ============================================
// Response Tracking Functions (要対応メッセージ)
// ============================================

// Update message to mark as needs response
export async function markMessageNeedsResponse(
  messageId: string,
  responseSummary?: string
) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineMessages)
    .set({
      needsResponse: true,
      responseStatus: "pending",
      responseSummary,
    })
    .where(eq(lineMessages.messageId, messageId));
}

// Mark message as responded
export async function markMessageResponded(
  lineGroupId: string,
  respondedBy: string
) {
  const db = await getDb();
  if (!db) return;
  
  // Mark all pending messages in this group as responded
  await db
    .update(lineMessages)
    .set({
      responseStatus: "responded",
      respondedAt: new Date(),
      respondedBy,
    })
    .where(
      and(
        eq(lineMessages.lineGroupId, lineGroupId),
        eq(lineMessages.responseStatus, "pending")
      )
    );
}

// Get pending response messages (for reminder job)
export async function getPendingResponseMessages() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending")
      )
    )
    .orderBy(lineMessages.createdAt);
}

// Get pending response messages grouped by group
export async function getPendingResponsesByGroup() {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db
    .select()
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending"),
        isNotNull(lineMessages.lineGroupId)
      )
    )
    .orderBy(lineMessages.createdAt);
  
  // Group by lineGroupId
  const grouped = new Map<string, typeof messages>();
  for (const msg of messages) {
    if (!msg.lineGroupId) continue;
    const existing = grouped.get(msg.lineGroupId) || [];
    existing.push(msg);
    grouped.set(msg.lineGroupId, existing);
  }
  
  return Array.from(grouped.entries()).map(([groupId, msgs]) => ({
    lineGroupId: groupId,
    messages: msgs,
    oldestPending: msgs[0],
    count: msgs.length,
  }));
}

// Update reminder sent for a message
export async function updateMessageReminderSent(messageId: string) {
  const db = await getDb();
  if (!db) return;
  
  const current = await db
    .select()
    .from(lineMessages)
    .where(eq(lineMessages.messageId, messageId))
    .limit(1);
  
  if (current.length > 0) {
    await db
      .update(lineMessages)
      .set({
        lastReminderAt: new Date(),
        reminderCount: current[0].reminderCount + 1,
      })
      .where(eq(lineMessages.messageId, messageId));
  }
}

// Cancel pending response (manual)
export async function cancelPendingResponse(messageId: string) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(lineMessages)
    .set({
      responseStatus: "cancelled",
    })
    .where(eq(lineMessages.messageId, messageId));
}

// Get pending responses for management UI
export async function getPendingResponsesForUI() {
  const db = await getDb();
  if (!db) return [];
  
  const messages = await db
    .select({
      id: lineMessages.id,
      messageId: lineMessages.messageId,
      lineGroupId: lineMessages.lineGroupId,
      senderName: lineMessages.senderName,
      content: lineMessages.content,
      responseSummary: lineMessages.responseSummary,
      reminderCount: lineMessages.reminderCount,
      lastReminderAt: lineMessages.lastReminderAt,
      createdAt: lineMessages.createdAt,
    })
    .from(lineMessages)
    .where(
      and(
        eq(lineMessages.needsResponse, true),
        eq(lineMessages.responseStatus, "pending")
      )
    )
    .orderBy(desc(lineMessages.createdAt));
  
  // Enrich with group names
  const result = [];
  for (const msg of messages) {
    let groupName = "不明";
    if (msg.lineGroupId) {
      const group = await db
        .select({ groupName: lineGroups.groupName })
        .from(lineGroups)
        .where(eq(lineGroups.lineGroupId, msg.lineGroupId))
        .limit(1);
      if (group.length > 0 && group[0].groupName) {
        groupName = group[0].groupName;
      }
    }
    result.push({
      ...msg,
      groupName,
      elapsedHours: Math.floor((Date.now() - new Date(msg.createdAt).getTime()) / (1000 * 60 * 60)),
    });
  }
  
  return result;
}


// ============================================
// Schedule Functions (カレンダー・スケジュール管理)
// ============================================

// Create a new schedule
export async function createSchedule(data: InsertSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(schedules).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get schedule by ID
export async function getScheduleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .limit(1);
  
  return result[0] || null;
}

// Get schedules for a specific date
export async function getSchedulesByDate(date: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${startOfDay}`,
        sql`${schedules.startTime} <= ${endOfDay}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Get schedules for a date range
export async function getSchedulesByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${startDate}`,
        sql`${schedules.startTime} <= ${endDate}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Get schedules by liver name
export async function getSchedulesByLiverName(liverName: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  // Normalize the search term by removing spaces for flexible matching
  // This handles cases where "京極琉" should match "京極 琉"
  const normalizedName = liverName.replace(/\s+/g, '');
  
  const conditions = [
    or(
      like(schedules.liverName, `%${liverName}%`),
      // Also search with spaces removed from the database value
      sql`REPLACE(${schedules.liverName}, ' ', '') LIKE ${`%${normalizedName}%`}`
    ),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}

// Get schedules by LINE group
export async function getSchedulesByLineGroup(lineGroupId: string, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(schedules.lineGroupId, lineGroupId),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}

// Update schedule
export async function updateSchedule(id: number, data: Partial<InsertSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(schedules)
    .set(data)
    .where(eq(schedules.id, id));
}

// Delete schedule (soft delete - set status to cancelled)
export async function deleteSchedule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(schedules)
    .set({ status: "cancelled" })
    .where(eq(schedules.id, id));
}

// Get all schedules (for management UI)
export async function getAllSchedules(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(not(eq(schedules.status, "cancelled")))
    .orderBy(asc(schedules.startTime))
    .limit(limit);
}

// Get upcoming schedules (from now)
export async function getUpcomingSchedules(days: number = 7) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        sql`${schedules.startTime} >= ${now}`,
        sql`${schedules.startTime} <= ${endDate}`,
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}

// Search schedules by title or description
export async function searchSchedules(query: string) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(schedules)
    .where(
      and(
        or(
          like(schedules.title, `%${query}%`),
          like(schedules.description, `%${query}%`),
          like(schedules.liverName, `%${query}%`)
        ),
        not(eq(schedules.status, "cancelled"))
      )
    )
    .orderBy(asc(schedules.startTime));
}


// =====================================================
// Liver (Streamer) Management Functions
// ライバー（配信者）管理関数
// =====================================================

// Create a new liver
export async function createLiver(data: InsertLiver) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(livers).values(data);
  const insertId = Number(result[0].insertId);
  return insertId;
}

// Get liver by email
export async function getLiverByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(livers)
    .where(eq(livers.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Get liver by ID
export async function getLiverById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(livers)
    .where(eq(livers.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Get all active livers
export async function getAllActiveLivers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livers)
    .where(eq(livers.isActive, true))
    .orderBy(asc(livers.name));
}

// Get all livers (including inactive)
export async function getAllLivers() {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livers)
    .orderBy(desc(livers.createdAt));
}

// Update liver
export async function updateLiver(id: number, data: Partial<InsertLiver>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set(data)
    .where(eq(livers.id, id));
}

// Update liver last login
export async function updateLiverLastLogin(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set({ lastLoginAt: new Date() })
    .where(eq(livers.id, id));
}

// Delete liver (soft delete - set isActive to false)
export async function deleteLiver(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livers)
    .set({ isActive: false })
    .where(eq(livers.id, id));
}

// Check if email already exists
export async function checkLiverEmailExists(email: string) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select({ id: livers.id })
    .from(livers)
    .where(eq(livers.email, email))
    .limit(1);
  
  return result.length > 0;
}

// Get schedules by liver ID
export async function getSchedulesByLiverId(liverId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(schedules.liverId, liverId),
    not(eq(schedules.status, "cancelled"))
  ];
  
  if (startDate) {
    conditions.push(sql`${schedules.startTime} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${schedules.startTime} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(schedules)
    .where(and(...conditions))
    .orderBy(asc(schedules.startTime));
}


// ============================================
// Livestream Products Functions (直播商品別GMV)
// ============================================

// Create a new livestream product
export async function createLivestreamProduct(data: InsertLivestreamProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(livestreamProducts).values(data);
  const insertId = Number(result[0].insertId);
  return { id: insertId, ...data };
}

// Get products by livestream ID
export async function getLivestreamProductsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId))
    .orderBy(desc(livestreamProducts.gmv));
}

// Update livestream product
export async function updateLivestreamProduct(id: number, data: Partial<InsertLivestreamProduct>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(livestreamProducts)
    .set(data)
    .where(eq(livestreamProducts.id, id));
}

// Delete livestream product
export async function deleteLivestreamProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.id, id));
}

// Get total GMV for a livestream from products
export async function getLivestreamProductsTotalGmv(livestreamId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const products = await db
    .select({ gmv: livestreamProducts.gmv })
    .from(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
  
  return products.reduce((sum, p) => sum + (p.gmv || 0), 0);
}

// Delete all products for a livestream
export async function deleteLivestreamProductsByLivestreamId(livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
}

// Bulk import products from CSV for a livestream
// This will delete existing products and insert new ones
export async function importLivestreamProductsFromCsv(
  livestreamId: number,
  products: Array<{
    productName: string;
    grossRevenue?: number | null;
    directGmv?: number | null;
    itemsSold?: number | null;
    customers?: number | null;
    orders?: number | null;
    ctr?: string | null;
    ctor?: string | null;
    productImpressions?: number | null;
    productClicks?: number | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete existing products for this livestream
  await db
    .delete(livestreamProducts)
    .where(eq(livestreamProducts.livestreamId, livestreamId));
  
  // Insert new products
  if (products.length > 0) {
    const insertData = products.map(p => ({
      livestreamId,
      productName: p.productName,
      grossRevenue: p.grossRevenue ?? null,
      directGmv: p.directGmv ?? null,
      gmv: p.directGmv ?? null, // Use directGmv as gmv for backward compatibility
      itemsSold: p.itemsSold ?? null,
      quantity: p.itemsSold ?? null, // Use itemsSold as quantity for backward compatibility
      customers: p.customers ?? null,
      orders: p.orders ?? null,
      ctr: p.ctr ?? null,
      ctor: p.ctor ?? null,
      productImpressions: p.productImpressions ?? null,
      impressions: p.productImpressions ?? null, // Backward compatibility
      productClicks: p.productClicks ?? null,
    }));
    
    await db.insert(livestreamProducts).values(insertData);
  }
  
  // Update the livestream to mark product CSV as imported
  await db
    .update(brandLivestreams)
    .set({ productCsvImported: "yes" })
    .where(eq(brandLivestreams.id, livestreamId));
  
  return products.length;
}

// Get all livestream products for a brand with livestream date info
export async function getAllLivestreamProductsForBrand(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestreams for the brand
  const livestreamList = await db
    .select()
    .from(brandLivestreams)
    .where(eq(brandLivestreams.brandId, brandId));
  
  // Get all products for these livestreams
  const livestreamIds = livestreamList.map(ls => ls.id);
  if (livestreamIds.length === 0) return [];
  
  const products = await db
    .select()
    .from(livestreamProducts)
    .where(inArray(livestreamProducts.livestreamId, livestreamIds));
  
  // Combine with livestream date info
  return products.map(product => {
    const livestream = livestreamList.find(ls => ls.id === product.livestreamId);
    return {
      ...product,
      livestreamDate: livestream?.livestreamDate,
    };
  });
}

// Get monthly GMV summary for a brand
export async function getMonthlyGmvSummary(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all livestreams for the brand
  const livestreamList = await db
    .select()
    .from(brandLivestreams)
    .where(eq(brandLivestreams.brandId, brandId))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  if (livestreamList.length === 0) return [];
  
  // Get all products for these livestreams
  const livestreamIds = livestreamList.map(ls => ls.id);
  const products = await db
    .select()
    .from(livestreamProducts)
    .where(inArray(livestreamProducts.livestreamId, livestreamIds));
  
  // Group by month
  const monthlyData: Record<string, { gmv: number; productCount: number; livestreamCount: number }> = {};
  
  livestreamList.forEach(ls => {
    const date = new Date(ls.livestreamDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { gmv: 0, productCount: 0, livestreamCount: 0 };
    }
    monthlyData[monthKey].livestreamCount++;
    
    // Add products GMV for this livestream
    const livestreamProducts = products.filter(p => p.livestreamId === ls.id);
    livestreamProducts.forEach(p => {
      monthlyData[monthKey].gmv += p.gmv || 0;
      monthlyData[monthKey].productCount++;
    });
  });
  
  // Convert to array and sort by month descending
  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      year: parseInt(month.split('-')[0]),
      monthNum: parseInt(month.split('-')[1]),
      ...data,
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
}


// Brand Memos functions
export async function createBrandMemo(memoData: InsertBrandMemo) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(brandMemos).values(memoData);
  return { id: Number(result[0].insertId), ...memoData };
}

export async function getMemosByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(brandMemos)
    .where(eq(brandMemos.brandId, brandId))
    .orderBy(desc(brandMemos.createdAt));
}

export async function deleteBrandMemo(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(brandMemos).where(eq(brandMemos.id, id));
}

export async function updateBrandMemo(id: number, updateData: Partial<InsertBrandMemo>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(brandMemos).set(updateData).where(eq(brandMemos.id, id));
}


// ============================================
// Contract-Livestream Links Functions (契約と直播の紐付け)
// ============================================

// Create a new contract-livestream link
export async function createContractLivestreamLink(data: InsertContractLivestreamLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(contractLivestreamLinks).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Get all livestream links for a contract
export async function getContractLivestreamLinks(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
}

// Get linked livestreams with details for a contract
export async function getContractLinkedLivestreams(contractId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all links for this contract
  const links = await db
    .select()
    .from(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
  
  if (links.length === 0) return [];
  
  // Get the livestream details
  const livestreamIds = links.map(l => l.livestreamId);
  const livestreams = await db
    .select()
    .from(brandLivestreams)
    .where(inArray(brandLivestreams.id, livestreamIds))
    .orderBy(desc(brandLivestreams.livestreamDate));
  
  return livestreams;
}

// Delete a contract-livestream link
export async function deleteContractLivestreamLink(contractId: number, livestreamId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(contractLivestreamLinks)
    .where(
      and(
        eq(contractLivestreamLinks.contractId, contractId),
        eq(contractLivestreamLinks.livestreamId, livestreamId)
      )
    );
}

// Delete all links for a contract
export async function deleteAllContractLivestreamLinks(contractId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(contractLivestreamLinks)
    .where(eq(contractLivestreamLinks.contractId, contractId));
}

// Check if a link already exists
export async function checkContractLivestreamLinkExists(contractId: number, livestreamId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select({ id: contractLivestreamLinks.id })
    .from(contractLivestreamLinks)
    .where(
      and(
        eq(contractLivestreamLinks.contractId, contractId),
        eq(contractLivestreamLinks.livestreamId, livestreamId)
      )
    )
    .limit(1);
  
  return result.length > 0;
}

// Calculate contract ROAS (GMV + Ad Value) / Fixed Fee
// CPM = ¥15,000 (15円/インプレッション)
// ROAS計算式: (広告換算費用 + GMV) ÷ 固定費
// 広告換算費用は「もし広告を出していたら発生していたコスト」なので、節約できた価値としてGMVに加算
export async function calculateContractRoas(contractId: number, fixedFee: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get linked livestreams
  const livestreams = await getContractLinkedLivestreams(contractId);
  
  if (livestreams.length === 0) {
    return {
      totalGmv: 0,
      totalImpressions: 0,
      adValue: 0,
      totalValue: 0,
      roas: 0,
      livestreamCount: 0,
    };
  }
  
  // Calculate totals
  const totalGmv = livestreams.reduce((sum, ls) => sum + (ls.gmv || 0), 0);
  const totalImpressions = livestreams.reduce((sum, ls) => sum + (ls.impressions || 0), 0);
  
  // Ad value calculation: impressions × ¥15 (CPM ¥15,000)
  const adValue = totalImpressions * 15;
  
  // Total value = GMV + Ad Value
  const totalValue = totalGmv + adValue;
  
  // ROAS = (GMV + 広告換算費用) ÷ 固定費
  // 固定費が0の場合は0を返す
  const roas = fixedFee > 0 ? totalValue / fixedFee : 0;
  
  return {
    totalGmv,
    totalImpressions,
    adValue,
    totalValue,
    roas,
    livestreamCount: livestreams.length,
  };
}


// ============================================
// Liver Livestream Functions (ライバー別配信履歴)
// ============================================

// Get livestreams by liver ID
export async function getLivestreamsByLiverId(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(brandLivestreams.liverId, liverId)];
  
  if (month) {
    // month format: "YYYY-MM"
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate}`);
    conditions.push(sql`${brandLivestreams.livestreamDate} <= ${endDate}`);
  }
  
  return await db
    .select()
    .from(brandLivestreams)
    .where(and(...conditions))
    .orderBy(desc(brandLivestreams.livestreamDate));
}

// Get liver statistics (monthly sales, total hours)
export async function getLiverStatistics(liverId: number, month?: string) {
  const db = await getDb();
  if (!db) return null;
  
  const conditions = [eq(brandLivestreams.liverId, liverId)];
  
  if (month) {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59);
    conditions.push(sql`${brandLivestreams.livestreamDate} >= ${startDate}`);
    conditions.push(sql`${brandLivestreams.livestreamDate} <= ${endDate}`);
  }
  
  const result = await db
    .select({
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.gmv}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
      livestreamCount: sql<number>`COUNT(*)`,
    })
    .from(brandLivestreams)
    .where(and(...conditions));
  
  return result[0];
}

// Get liver rankings (sales ranking, duration ranking)
export async function getLiverRankings(month: string) {
  const db = await getDb();
  if (!db) return { salesRanking: [], durationRanking: [] };
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Sales ranking
  const salesRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: brandLivestreams.streamerName,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.gmv}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`
      )
    )
    .groupBy(brandLivestreams.liverId, brandLivestreams.streamerName)
    .orderBy(sql`SUM(${brandLivestreams.gmv}) DESC`)
    .limit(10);
  
  // Duration ranking
  const durationRanking = await db
    .select({
      liverId: brandLivestreams.liverId,
      streamerName: brandLivestreams.streamerName,
      totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.gmv}), 0)`,
      totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
    })
    .from(brandLivestreams)
    .where(
      and(
        sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
        sql`${brandLivestreams.livestreamDate} <= ${endDate}`
      )
    )
    .groupBy(brandLivestreams.liverId, brandLivestreams.streamerName)
    .orderBy(sql`SUM(${brandLivestreams.duration}) DESC`)
    .limit(10);
  
  return { salesRanking, durationRanking };
}

// Get livestream by ID with brand info
export async function getLivestreamById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(brandLivestreams)
    .where(eq(brandLivestreams.id, id))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Update livestream result (配信結果の記録)
export async function updateLivestreamResult(id: number, data: {
  result?: "成功" | "失敗";
  impactFactor?: "構成" | "商品" | "ライバー" | "広告" | "その他";
  resultReason?: string;
  screenshotUrl?: string;
  screenshotKey?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandLivestreams)
    .set(data)
    .where(eq(brandLivestreams.id, id));
}

// Get all livers with their statistics for a given month
export async function getLiversWithStats(month: string) {
  const db = await getDb();
  if (!db) return [];
  
  const [year, monthNum] = month.split('-').map(Number);
  const startDate = new Date(year, monthNum - 1, 1);
  const endDate = new Date(year, monthNum, 0, 23, 59, 59);
  
  // Get all active livers
  const allLivers = await db
    .select()
    .from(livers)
    .where(eq(livers.isActive, true))
    .orderBy(asc(livers.name));
  
  // Get stats for each liver
  const liversWithStats = await Promise.all(
    allLivers.map(async (liver) => {
      const stats = await db
        .select({
          totalSales: sql<number>`COALESCE(SUM(${brandLivestreams.gmv}), 0)`,
          totalDuration: sql<number>`COALESCE(SUM(${brandLivestreams.duration}), 0)`,
          livestreamCount: sql<number>`COUNT(*)`,
        })
        .from(brandLivestreams)
        .where(
          and(
            eq(brandLivestreams.liverId, liver.id),
            sql`${brandLivestreams.livestreamDate} >= ${startDate}`,
            sql`${brandLivestreams.livestreamDate} <= ${endDate}`
          )
        );
      
      return {
        ...liver,
        totalSales: stats[0]?.totalSales || 0,
        totalDuration: stats[0]?.totalDuration || 0,
        livestreamCount: stats[0]?.livestreamCount || 0,
      };
    })
  );
  
  return liversWithStats;
}



// ============================================
// Brand Edit Log Functions (編集ログ)
// ============================================

// Create a new edit log entry
export async function createBrandEditLog(data: InsertBrandEditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandEditLogs).values(data);
  return { id: Number(result[0].insertId), ...data };
}

// Get edit logs for a brand
export async function getBrandEditLogs(brandId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandEditLogs)
    .where(eq(brandEditLogs.brandId, brandId))
    .orderBy(desc(brandEditLogs.createdAt))
    .limit(limit);
}

// Helper function to create edit log with common fields
export async function logBrandEdit(
  brandId: number,
  actionType: "create" | "update" | "delete",
  entityType: "brand" | "product" | "livestream" | "contract" | "memo",
  entityId: number | null,
  entityName: string | null,
  changeDescription: string,
  userId: number,
  userName: string,
  previousValue?: string,
  newValue?: string
) {
  return await createBrandEditLog({
    brandId,
    actionType,
    entityType,
    entityId,
    entityName,
    changeDescription,
    previousValue,
    newValue,
    userId,
    userName,
  });
}


// ============================================
// Brand Product Images Functions (商品画像)
// ============================================

// Get all images for a product
export async function getProductImages(productId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandProductImages)
    .where(eq(brandProductImages.productId, productId))
    .orderBy(asc(brandProductImages.sortOrder));
}

// Add a new image to a product
export async function addProductImage(data: InsertBrandProductImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the max sort order for this product
  const existing = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${brandProductImages.sortOrder}), -1)` })
    .from(brandProductImages)
    .where(eq(brandProductImages.productId, data.productId));
  
  const nextOrder = (existing[0]?.maxOrder ?? -1) + 1;
  
  const result = await db.insert(brandProductImages).values({
    ...data,
    sortOrder: data.sortOrder ?? nextOrder,
  });
  
  return { id: Number(result[0].insertId), ...data, sortOrder: nextOrder };
}

// Delete an image
export async function deleteProductImage(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(brandProductImages).where(eq(brandProductImages.id, imageId));
  return { success: true };
}

// Update image sort order
export async function updateProductImageOrder(imageId: number, sortOrder: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandProductImages)
    .set({ sortOrder })
    .where(eq(brandProductImages.id, imageId));
  
  return { success: true };
}

// Reorder all images for a product
export async function reorderProductImages(productId: number, imageIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Update each image's sort order based on its position in the array
  for (let i = 0; i < imageIds.length; i++) {
    await db
      .update(brandProductImages)
      .set({ sortOrder: i })
      .where(and(
        eq(brandProductImages.id, imageIds[i]),
        eq(brandProductImages.productId, productId)
      ));
  }
  
  return { success: true };
}


// ========================================
// Brand Files Functions
// ブランドファイル管理関数
// ========================================

/**
 * Get all files for a brand
 */
export async function getBrandFiles(brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.brandId, brandId))
    .orderBy(desc(brandFiles.createdAt));
  
  return result;
}

/**
 * Create a new brand file record
 */
export async function createBrandFile(data: InsertBrandFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandFiles).values(data);
  return { id: result[0].insertId };
}

/**
 * Delete a brand file record
 */
export async function deleteBrandFile(fileId: number, brandId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // First get the file to return the key for S3 deletion
  const file = await db
    .select()
    .from(brandFiles)
    .where(and(eq(brandFiles.id, fileId), eq(brandFiles.brandId, brandId)))
    .limit(1);
  
  if (file.length === 0) {
    throw new Error("File not found");
  }
  
  await db
    .delete(brandFiles)
    .where(and(eq(brandFiles.id, fileId), eq(brandFiles.brandId, brandId)));
  
  return { fileKey: file[0].fileKey, fileName: file[0].fileName };
}

/**
 * Get a single brand file by ID
 */
export async function getBrandFileById(fileId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db
    .select()
    .from(brandFiles)
    .where(eq(brandFiles.id, fileId))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}


// ==================== Product Links Functions ====================

/**
 * Get all links for a product
 */
export async function getProductLinks(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db
    .select()
    .from(productLinks)
    .where(eq(productLinks.productId, productId))
    .orderBy(asc(productLinks.sortOrder), asc(productLinks.id));
}

/**
 * Add a link to a product
 */
export async function addProductLink(data: {
  productId: number;
  title: string;
  url: string;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the max sortOrder for this product
  const maxOrder = await db
    .select({ maxOrder: sql<number>`COALESCE(MAX(${productLinks.sortOrder}), -1)` })
    .from(productLinks)
    .where(eq(productLinks.productId, data.productId));
  
  const sortOrder = (maxOrder[0]?.maxOrder ?? -1) + 1;
  
  const result = await db.insert(productLinks).values({
    productId: data.productId,
    title: data.title,
    url: data.url,
    sortOrder,
    createdBy: data.createdBy,
  });
  
  return { id: result[0].insertId, sortOrder };
}

/**
 * Update a product link
 */
export async function updateProductLink(linkId: number, data: {
  title?: string;
  url?: string;
  sortOrder?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(productLinks)
    .set(data)
    .where(eq(productLinks.id, linkId));
  
  return { success: true };
}

/**
 * Delete a product link
 */
export async function deleteProductLink(linkId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(productLinks)
    .where(eq(productLinks.id, linkId));
  
  return { success: true };
}

/**
 * Get links for multiple products at once
 */
export async function getProductLinksForProducts(productIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (productIds.length === 0) return [];
  
  return await db
    .select()
    .from(productLinks)
    .where(inArray(productLinks.productId, productIds))
    .orderBy(asc(productLinks.sortOrder), asc(productLinks.id));
}


// ============================================
// CSV Import Functions (TikTok配信パフォーマンスCSVインポート)
// ============================================

/**
 * Check if a livestream already exists by date and streamer name
 */
export async function findExistingLivestream(
  brandId: number,
  livestreamDate: Date,
  streamerName: string
) {
  const db = await getDb();
  if (!db) return null;
  
  // Find livestream within 1 hour of the given date with matching streamer name
  const startRange = new Date(livestreamDate.getTime() - 60 * 60 * 1000); // 1 hour before
  const endRange = new Date(livestreamDate.getTime() + 60 * 60 * 1000); // 1 hour after
  
  const result = await db
    .select()
    .from(brandLivestreams)
    .where(
      and(
        eq(brandLivestreams.brandId, brandId),
        sql`${brandLivestreams.livestreamDate} >= ${startRange}`,
        sql`${brandLivestreams.livestreamDate} <= ${endRange}`,
        eq(brandLivestreams.streamerName, streamerName)
      )
    )
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Update an existing livestream with CSV data
 */
export async function updateLivestreamFromCsv(
  id: number,
  data: Partial<InsertBrandLivestream>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(brandLivestreams)
    .set({
      ...data,
      csvImported: "yes",
    })
    .where(eq(brandLivestreams.id, id));
  
  return { id, updated: true };
}

/**
 * Create a new livestream from CSV data
 */
export async function createLivestreamFromCsv(data: InsertBrandLivestream) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(brandLivestreams).values({
    ...data,
    csvImported: "yes",
  });
  
  const insertId = (result as any)[0]?.insertId;
  return { id: insertId, created: true };
}

/**
 * Get all livestreams for a brand that were imported from CSV
 */
export async function getCsvImportedLivestreams(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(brandLivestreams)
    .where(
      and(
        eq(brandLivestreams.brandId, brandId),
        eq(brandLivestreams.csvImported, "yes")
      )
    )
    .orderBy(desc(brandLivestreams.livestreamDate));
}
