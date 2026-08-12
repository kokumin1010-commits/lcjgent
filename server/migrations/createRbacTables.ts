import { MySql2Database } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

export async function createRbacTables(db: MySql2Database) {
  console.log("[Migration] Creating RBAC (roles/permissions) tables...");

  // 1. Roles table - custom roles that can be assigned to users
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500),
      color VARCHAR(20) DEFAULT '#6366f1',
      isSystem BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_role_name (name)
    )
  `);

  // 2. Role permissions table - which pages/features each role can access
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      roleId INT NOT NULL,
      pageKey VARCHAR(255) NOT NULL,
      canView BOOLEAN NOT NULL DEFAULT TRUE,
      canEdit BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_role_page (roleId, pageKey),
      INDEX idx_roleId (roleId)
    )
  `);

  // 3. User role assignment table - maps users to custom roles
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_role_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      roleId INT NOT NULL,
      assignedBy INT,
      assignedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY idx_user_role (userId),
      INDEX idx_roleId (roleId)
    )
  `);

  // 4. Insert default system roles if not exist
  const existingRoles = await db.execute(sql`SELECT COUNT(*) as cnt FROM system_roles`);
  const count = (existingRoles as any)[0]?.[0]?.cnt ?? 0;
  if (count === 0) {
    await db.execute(sql`
      INSERT INTO system_roles (name, description, color, isSystem) VALUES
      ('超级管理员', '全部权限，系统最高权限', '#ef4444', TRUE),
      ('管理员', '大部分管理权限', '#8b5cf6', FALSE),
      ('运营', '选品、Rundown、品牌管理等运营相关', '#3b82f6', FALSE),
      ('财务', '财务管理、Cashflow相关', '#10b981', FALSE),
      ('ライバー管理', 'ライバー相关管理', '#f59e0b', FALSE),
      ('普通员工', '基本功能访问', '#6b7280', FALSE)
    `);

    // Assign all permissions to 超级管理员 (role id 1)
    const allPages = [
      '/master', '/master/morning-meeting', '/master/tasks', '/master/reports',
      '/master/report-analysis', '/master/report-staff', '/master/hr',
      '/master/brands', '/master/brand-addition-logs', '/master/recruitment',
      '/master/brand-applications', '/master/ad-form-submissions',
      '/master/business-cards', '/master/line', '/master/chat',
      '/staff-schedule', '/master/livers', '/master/livers-dashboard',
      '/master/ai-coach', '/master/lcj-brain', '/master/mega-channel',
      '/master/featured-products', '/master/ad-dashboard', '/master/short-video',
      '/master/agencies', '/master/brand-portal', '/master/sales-check',
      '/master/simulator', '/master/live-suggestions', '/master/rundown',
      '/master/set-applications', '/master/set-suggestions', '/master/sample-requests',
      '/master/mall', '/master/blog', '/master/referral', '/master/receipts',
      '/master/step-email', '/master/step-email/logs', '/master/step-email/analytics',
      '/master/receipt-analytics', '/master/product-requests', '/master/staff',
      '/master/finance', '/master/lcj-coin', '/master/buyback', '/master/festival',
      '/master/issues', '/master/control', '/master/selection-center',
      '/master/account-management', '/master/set-image-generator',
      '/master/system-users', '/master/product-lab'
    ];

    // Insert all permissions for super admin (roleId=1)
    for (const page of allPages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (1, ${page}, TRUE, TRUE)
      `);
    }

    // Insert permissions for 管理員 (roleId=2) - all except system-users and control
    const adminPages = allPages.filter(p => p !== '/master/system-users' && p !== '/master/control');
    for (const page of adminPages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (2, ${page}, TRUE, TRUE)
      `);
    }

    // Insert permissions for 运营 (roleId=3)
    const opsPages = [
      '/master', '/master/morning-meeting', '/master/tasks', '/master/reports',
      '/master/brands', '/master/brand-addition-logs', '/master/recruitment',
      '/master/brand-applications', '/master/livers', '/master/livers-dashboard',
      '/master/rundown', '/master/selection-center', '/master/set-image-generator',
      '/master/set-applications', '/master/set-suggestions', '/master/sample-requests',
      '/master/live-suggestions', '/master/simulator', '/master/featured-products',
      '/master/chat', '/staff-schedule'
    ];
    for (const page of opsPages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (3, ${page}, TRUE, TRUE)
      `);
    }

    // Insert permissions for 財務 (roleId=4)
    const financePages = [
      '/master', '/master/finance', '/master/receipts', '/master/receipt-analytics',
      '/master/reports', '/master/chat', '/staff-schedule'
    ];
    for (const page of financePages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (4, ${page}, TRUE, TRUE)
      `);
    }

    // Insert permissions for ライバー管理 (roleId=5)
    const liverPages = [
      '/master', '/master/livers', '/master/livers-dashboard', '/master/ai-coach',
      '/master/mega-channel', '/master/rundown', '/master/live-suggestions',
      '/master/simulator', '/master/chat', '/staff-schedule', '/master/morning-meeting'
    ];
    for (const page of liverPages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (5, ${page}, TRUE, TRUE)
      `);
    }

    // Insert permissions for 普通員工 (roleId=6)
    const basicPages = [
      '/master', '/master/tasks', '/master/chat', '/staff-schedule',
      '/master/morning-meeting', '/master/reports'
    ];
    for (const page of basicPages) {
      await db.execute(sql`
        INSERT IGNORE INTO role_permissions (roleId, pageKey, canView, canEdit)
        VALUES (6, ${page}, TRUE, FALSE)
      `);
    }
  }

  console.log("[Migration] RBAC tables created successfully");
}
