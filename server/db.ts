import { eq, and, desc, asc, sql, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, staff, InsertStaff, tasks, InsertTask, reminders, InsertReminder, taskStaff, InsertTaskStaff, emailTracking, InsertEmailTracking, reportStaff, InsertReportStaff, reports, InsertReport, brands, InsertBrand, brandProducts, InsertBrandProduct, brandActivities, InsertBrandActivity, brandLivestreams, InsertBrandLivestream, reportFollowups, InsertReportFollowup, businessCards, InsertBusinessCard } from "../drizzle/schema";

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
  return result;
}

// Get all brands with optional filters
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
  
  return await query.orderBy(desc(brands.updatedAt));
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
  return result;
}

// Get products by brand ID
export async function getProductsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.createdAt));
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
  return result;
}

// Get livestreams by brand ID
export async function getLivestreamsByBrandId(brandId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(brandLivestreams).where(eq(brandLivestreams.brandId, brandId)).orderBy(desc(brandLivestreams.livestreamDate));
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
