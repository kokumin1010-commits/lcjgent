import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

// Import schema dynamically to ensure proper loading
import { reports, staff, users } from '../drizzle/schema';

// Test database connection
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  if (process.env.DATABASE_URL) {
    db = drizzle(process.env.DATABASE_URL);
  }
});

describe('Reports Database Operations', () => {
  it('should query reports table successfully', async () => {
    if (!db) {
      console.log('Skipping test: DATABASE_URL not set');
      return;
    }

    // Verify reports table is defined
    expect(reports).toBeDefined();
    
    // Test that we can query the reports table
    const result = await db.select().from(reports).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should insert and retrieve a report', async () => {
    if (!db) {
      console.log('Skipping test: DATABASE_URL not set');
      return;
    }

    // First, get an existing staff member
    const existingStaff = await db.select().from(staff).limit(1);
    if (existingStaff.length === 0) {
      console.log('Skipping test: No staff members in database');
      return;
    }

    // Get an existing user for createdBy
    const existingUser = await db.select().from(users).limit(1);
    if (existingUser.length === 0) {
      console.log('Skipping test: No users in database');
      return;
    }

    const testStaffId = existingStaff[0].id;
    const testUserId = existingUser[0].id;
    const testDate = new Date();
    const testWorkContent = `Test report content - ${Date.now()}`;

    // Insert a test report
    const insertResult = await db.insert(reports).values({
      staffId: testStaffId,
      reportDate: testDate,
      workContent: testWorkContent,
      issues: 'Test issues',
      remarks: 'Test remarks',
      createdBy: testUserId,
    });

    expect(insertResult).toBeDefined();

    // Retrieve the report
    const retrievedReports = await db
      .select()
      .from(reports)
      .where(eq(reports.workContent, testWorkContent))
      .limit(1);

    expect(retrievedReports.length).toBe(1);
    expect(retrievedReports[0].workContent).toBe(testWorkContent);
    expect(retrievedReports[0].staffId).toBe(testStaffId);

    // Clean up - delete the test report
    await db.delete(reports).where(eq(reports.id, retrievedReports[0].id));
  });
});
