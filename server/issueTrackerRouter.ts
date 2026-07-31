/**
 * Issue Tracker Router - 問題処理系統
 * 
 * 内部チーム向けの問題追跡・知識管理プラットフォーム
 * - 問題の作成・更新・削除
 * - ステータス管理（看板）
 * - コメント・動態記録
 * - 知識ベース（解決済み問題の自動アーカイブ）
 * - 統計分析
 * - AI分類提案・類似問題推薦
 */
import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import mysql from "mysql2/promise";
import { invokeLLM } from "./_core/llm";
import { sendEmail } from "./emailService";

// Reuse the pool from selectionCenterRouter
let _pool: mysql.Pool | null = null;
function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    _pool = mysql.createPool(process.env.DATABASE_URL);
  }
  return _pool!;
}

// Auto-init: create tables on import
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      const pool = mysql.createPool(process.env.DATABASE_URL);
      
      await pool.query(`CREATE TABLE IF NOT EXISTS issues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        category ENUM('operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other') DEFAULT 'other',
        priority ENUM('urgent', 'high', 'medium', 'low') DEFAULT 'medium',
        status ENUM('pending', 'in_progress', 'waiting_confirm', 'completed', 'closed') DEFAULT 'pending',
        creatorId INT,
        creatorName VARCHAR(255),
        assigneeId INT,
        assigneeName VARCHAR(255),
        helperId INT,
        helperName VARCHAR(255),
        deadline DATETIME,
        solution TEXT,
        attachments JSON,
        tags JSON,
        relatedIssueId INT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completedAt DATETIME,
        INDEX idx_status (status),
        INDEX idx_category (category),
        INDEX idx_priority (priority),
        INDEX idx_assignee (assigneeId),
        INDEX idx_creator (creatorId),
        INDEX idx_created (createdAt)
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS issue_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issueId INT NOT NULL,
        authorId INT,
        authorName VARCHAR(255),
        content TEXT NOT NULL,
        type ENUM('comment', 'status_change', 'assignment', 'system') DEFAULT 'comment',
        metadata JSON,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_issue (issueId),
        FOREIGN KEY (issueId) REFERENCES issues(id) ON DELETE CASCADE
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS issue_knowledge (
        id INT AUTO_INCREMENT PRIMARY KEY,
        issueId INT,
        title VARCHAR(500) NOT NULL,
        category ENUM('operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other') DEFAULT 'other',
        problem TEXT,
        solution TEXT NOT NULL,
        keywords JSON,
        useCount INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_keywords ((CAST(keywords AS CHAR(500))))
      )`);

      await pool.end();
    }
  } catch (err) {
    console.warn("[IssueTracker] Auto-init tables warning:", err);
  }
})();

export const issueTrackerRouter = router({
  // ============ Issues CRUD ============

  // List issues with filters
  list: protectedProcedure
    .input(z.object({
      status: z.enum(['pending', 'in_progress', 'waiting_confirm', 'completed', 'closed', 'all']).optional().default('all'),
      category: z.enum(['operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other', 'all']).optional().default('all'),
      priority: z.enum(['urgent', 'high', 'medium', 'low', 'all']).optional().default('all'),
      assigneeId: z.number().optional(),
      search: z.string().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      let where = 'WHERE 1=1';
      const params: any[] = [];

      // Privacy: non-admin users can only see issues they created, are assigned to, or are helper of
      const userId = (ctx as any).user?.id;
      const userRole = (ctx as any).user?.role;
      if (userRole !== 'admin' && userId) {
        where += ' AND (creatorId = ? OR assigneeId = ? OR helperId = ?)';
        params.push(userId, userId, userId);
      }

      if (input.status !== 'all') {
        where += ' AND status = ?';
        params.push(input.status);
      }
      if (input.category !== 'all') {
        where += ' AND category = ?';
        params.push(input.category);
      }
      if (input.priority !== 'all') {
        where += ' AND priority = ?';
        params.push(input.priority);
      }
      if (input.assigneeId) {
        where += ' AND assigneeId = ?';
        params.push(input.assigneeId);
      }
      if (input.search) {
        where += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(`%${input.search}%`, `%${input.search}%`);
      }

      const offset = (input.page - 1) * input.pageSize;
      
      const [rows] = await pool.query(
        `SELECT * FROM issues ${where} ORDER BY 
          CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
          createdAt DESC
         LIMIT ? OFFSET ?`,
        [...params, input.pageSize, offset]
      );

      const [countResult] = await pool.query(
        `SELECT COUNT(*) as total FROM issues ${where}`,
        params
      );

      return {
        issues: rows as any[],
        total: (countResult as any[])[0]?.total || 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Get single issue with comments
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      const [issues] = await pool.query('SELECT * FROM issues WHERE id = ?', [input.id]);
      const issue = (issues as any[])[0];
      if (!issue) return null;

      // Privacy check: only creator, assignee, helper, or admin can view
      const userId = (ctx as any).user?.id;
      const userRole = (ctx as any).user?.role;
      if (userRole !== 'admin' && userId) {
        if (issue.creatorId !== userId && issue.assigneeId !== userId && issue.helperId !== userId) {
          return null;
        }
      }

      const [comments] = await pool.query(
        'SELECT * FROM issue_comments WHERE issueId = ? ORDER BY createdAt ASC',
        [input.id]
      );

      return { ...issue, comments: comments as any[] };
    }),

  // Create issue
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(['operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other']).optional().default('other'),
      priority: z.enum(['urgent', 'high', 'medium', 'low']).optional().default('medium'),
      assigneeId: z.number().optional(),
      assigneeName: z.string().optional(),
      helperId: z.number().optional(),
      helperName: z.string().optional(),
      deadline: z.string().optional(),
      tags: z.array(z.string()).optional(),
      attachments: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT INTO issues (title, description, category, priority, assigneeId, assigneeName, helperId, helperName, deadline, tags, attachments, creatorId, creatorName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.title,
          input.description || null,
          input.category,
          input.priority,
          input.assigneeId || null,
          input.assigneeName || null,
          input.helperId || null,
          input.helperName || null,
          input.deadline || null,
          JSON.stringify(input.tags || []),
          JSON.stringify(input.attachments || []),
          (ctx as any).user?.id || null,
          (ctx as any).user?.displayName || (ctx as any).user?.name || 'Unknown',
        ]
      );

      const issueId = (result as any).insertId;

      // Add system comment for creation
      await pool.query(
        `INSERT INTO issue_comments (issueId, authorName, content, type) VALUES (?, ?, ?, 'system')`,
        [issueId, (ctx as any).user?.displayName || 'System', '問題を作成しました']
      );

      // Send email notification to assignee
      if (input.assigneeId || input.assigneeName) {
        try {
          let staffRows: any[];
          if (input.assigneeId) {
            const [rows] = await pool.query(
              'SELECT email, name FROM staff WHERE id = ? AND isActive = "active"',
              [input.assigneeId]
            ) as any;
            staffRows = rows;
          } else {
            const [rows] = await pool.query(
              'SELECT email, name FROM staff WHERE name = ? AND isActive = "active" LIMIT 1',
              [input.assigneeName]
            ) as any;
            staffRows = rows;
          }
          if (staffRows.length > 0 && staffRows[0].email) {
            const assigneeEmail = staffRows[0].email;
            const creatorName = (ctx as any).user?.displayName || (ctx as any).user?.name || 'Unknown';
            const priorityMap: Record<string, string> = { urgent: '\ud83d\udd34 緊急', high: '\ud83d\udfe0 高', medium: '\ud83d\udfe1 中', low: '\ud83d\udfe2 低' };
            const categoryMap: Record<string, string> = { operation: '運営', technical: '技術', logistics: '物流', customer_service: 'カスタマー', finance: '財務', hr: '人事', other: 'その他' };
            const subject = `【問題割当】${input.title}`;
            const html = `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a56db;">📋 新しい問題が割り当てられました</h2>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 100px;">タイトル</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${input.title}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">優先度</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${priorityMap[input.priority] || input.priority}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">分類</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${categoryMap[input.category] || input.category}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">作成者</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${creatorName}</td></tr>
                  <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">期限</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${input.deadline || '未設定'}</td></tr>
                </table>
                ${input.description ? `<div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin: 16px 0;"><strong>詳細:</strong><br/>${input.description}</div>` : ''}
                <p style="margin-top: 20px;"><a href="https://lcjmall.com/master/issues" style="background: #1a56db; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">問題を確認する →</a></p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">このメールはLCJ問題処理系統から自動送信されています。</p>
              </div>
            `;
            await sendEmail({
              to: [assigneeEmail],
              subject,
              content: `新しい問題「${input.title}」が割り当てられました。優先度: ${priorityMap[input.priority] || input.priority}。https://lcjmall.com/master/issues で確認してください。`,
              html,
            });
            console.log(`[IssueTracker] Email notification sent to ${assigneeEmail} for issue #${issueId}`);
          }
        } catch (emailErr) {
          console.error('[IssueTracker] Failed to send email notification:', emailErr);
          // Don't fail the issue creation if email fails
        }
      }

      return { id: issueId, success: true };
    }),

  // Update issue
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(['operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other']).optional(),
      priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(),
      status: z.enum(['pending', 'in_progress', 'waiting_confirm', 'completed', 'closed']).optional(),
      assigneeId: z.number().nullable().optional(),
      assigneeName: z.string().nullable().optional(),
      helperId: z.number().nullable().optional(),
      helperName: z.string().nullable().optional(),
      deadline: z.string().nullable().optional(),
      solution: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      attachments: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const { id, ...updates } = input;

      // Get current issue for comparison
      const [current] = await pool.query('SELECT * FROM issues WHERE id = ?', [id]);
      const currentIssue = (current as any[])[0];
      if (!currentIssue) throw new Error('Issue not found');

      const setClauses: string[] = [];
      const values: any[] = [];

      if (updates.title !== undefined) { setClauses.push('title = ?'); values.push(updates.title); }
      if (updates.description !== undefined) { setClauses.push('description = ?'); values.push(updates.description); }
      if (updates.category !== undefined) { setClauses.push('category = ?'); values.push(updates.category); }
      if (updates.priority !== undefined) { setClauses.push('priority = ?'); values.push(updates.priority); }
      if (updates.status !== undefined) {
        setClauses.push('status = ?'); values.push(updates.status);
        if (updates.status === 'completed' && currentIssue.status !== 'completed') {
          setClauses.push('completedAt = NOW()');
        }
      }
      if (updates.assigneeId !== undefined) { setClauses.push('assigneeId = ?'); values.push(updates.assigneeId); }
      if (updates.assigneeName !== undefined) { setClauses.push('assigneeName = ?'); values.push(updates.assigneeName); }
      if (updates.helperId !== undefined) { setClauses.push('helperId = ?'); values.push(updates.helperId); }
      if (updates.helperName !== undefined) { setClauses.push('helperName = ?'); values.push(updates.helperName); }
      if (updates.deadline !== undefined) { setClauses.push('deadline = ?'); values.push(updates.deadline); }
      if (updates.solution !== undefined) { setClauses.push('solution = ?'); values.push(updates.solution); }
      if (updates.tags !== undefined) { setClauses.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
      if (updates.attachments !== undefined) { setClauses.push('attachments = ?'); values.push(JSON.stringify(updates.attachments)); }

      if (setClauses.length > 0) {
        await pool.query(
          `UPDATE issues SET ${setClauses.join(', ')} WHERE id = ?`,
          [...values, id]
        );
      }

      // Add activity comments for status/assignment changes
      const userName = (ctx as any).user?.displayName || (ctx as any).user?.name || 'Unknown';
      if (updates.status && updates.status !== currentIssue.status) {
        const statusLabels: Record<string, string> = {
          pending: '待处理', in_progress: '处理中', waiting_confirm: '待确认',
          completed: '已完成', closed: '已关闭'
        };
        await pool.query(
          `INSERT INTO issue_comments (issueId, authorName, content, type, metadata) VALUES (?, ?, ?, 'status_change', ?)`,
          [id, userName, `ステータスを「${statusLabels[updates.status]}」に変更しました`, JSON.stringify({ from: currentIssue.status, to: updates.status })]
        );
      }
      if (updates.assigneeName && updates.assigneeName !== currentIssue.assigneeName) {
        await pool.query(
          `INSERT INTO issue_comments (issueId, authorName, content, type) VALUES (?, ?, ?, 'assignment')`,
          [id, userName, `担当者を「${updates.assigneeName}」に変更しました`]
        );
      }

      return { success: true };
    }),

  // Delete issue
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query('DELETE FROM issues WHERE id = ?', [input.id]);
      return { success: true };
    }),

  // Update status only (for kanban drag)
  updateStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(['pending', 'in_progress', 'waiting_confirm', 'completed', 'closed']),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const updates: string[] = ['status = ?'];
      const values: any[] = [input.status];
      
      if (input.status === 'completed') {
        updates.push('completedAt = NOW()');
      }
      
      await pool.query(`UPDATE issues SET ${updates.join(', ')} WHERE id = ?`, [...values, input.id]);

      const statusLabels: Record<string, string> = {
        pending: '待处理', in_progress: '处理中', waiting_confirm: '待确认',
        completed: '已完成', closed: '已关闭'
      };
      const userName = (ctx as any).user?.displayName || (ctx as any).user?.name || 'System';
      await pool.query(
        `INSERT INTO issue_comments (issueId, authorName, content, type) VALUES (?, ?, ?, 'status_change')`,
        [input.id, userName, `ステータスを「${statusLabels[input.status]}」に変更しました`]
      );

      return { success: true };
    }),

  // ============ Comments ============

  addComment: protectedProcedure
    .input(z.object({
      issueId: z.number(),
      content: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const pool = getPool();
      const [result] = await pool.query(
        `INSERT INTO issue_comments (issueId, authorId, authorName, content, type) VALUES (?, ?, ?, ?, 'comment')`,
        [
          input.issueId,
          (ctx as any).user?.id || null,
          (ctx as any).user?.displayName || (ctx as any).user?.name || 'Unknown',
          input.content,
        ]
      );
      return { id: (result as any).insertId, success: true };
    }),

  // ============ Knowledge Base ============

  // Archive issue solution to knowledge base
  archiveToKnowledge: protectedProcedure
    .input(z.object({
      issueId: z.number(),
      title: z.string().optional(),
      keywords: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      const [issues] = await pool.query('SELECT * FROM issues WHERE id = ?', [input.issueId]);
      const issue = (issues as any[])[0];
      if (!issue) throw new Error('Issue not found');
      if (!issue.solution) throw new Error('No solution to archive');

      const [result] = await pool.query(
        `INSERT INTO issue_knowledge (issueId, title, category, problem, solution, keywords) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          input.issueId,
          input.title || issue.title,
          issue.category,
          issue.description || issue.title,
          issue.solution,
          JSON.stringify(input.keywords || []),
        ]
      );
      return { id: (result as any).insertId, success: true };
    }),

  // List knowledge base
  listKnowledge: protectedProcedure
    .input(z.object({
      category: z.enum(['operation', 'technical', 'logistics', 'customer_service', 'finance', 'hr', 'other', 'all']).optional().default('all'),
      search: z.string().optional(),
      page: z.number().optional().default(1),
      pageSize: z.number().optional().default(20),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      let where = 'WHERE 1=1';
      const params: any[] = [];

      if (input.category !== 'all') {
        where += ' AND category = ?';
        params.push(input.category);
      }
      if (input.search) {
        where += ' AND (title LIKE ? OR problem LIKE ? OR solution LIKE ?)';
        params.push(`%${input.search}%`, `%${input.search}%`, `%${input.search}%`);
      }

      const offset = (input.page - 1) * input.pageSize;
      const [rows] = await pool.query(
        `SELECT * FROM issue_knowledge ${where} ORDER BY useCount DESC, createdAt DESC LIMIT ? OFFSET ?`,
        [...params, input.pageSize, offset]
      );
      const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM issue_knowledge ${where}`, params);

      return {
        items: rows as any[],
        total: (countResult as any[])[0]?.total || 0,
      };
    }),

  // Search similar issues (for AI recommendation)
  searchSimilar: protectedProcedure
    .input(z.object({ title: z.string(), description: z.string().optional() }))
    .query(async ({ input }) => {
      const pool = getPool();
      const searchText = `${input.title} ${input.description || ''}`;
      const keywords = searchText.split(/[\s,、。]+/).filter(w => w.length > 1).slice(0, 5);
      
      if (keywords.length === 0) return { issues: [], knowledge: [] };

      const likeConditions = keywords.map(() => '(title LIKE ? OR description LIKE ?)').join(' OR ');
      const likeParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);

      // Search completed issues
      const [issues] = await pool.query(
        `SELECT id, title, category, solution, completedAt FROM issues 
         WHERE status IN ('completed', 'closed') AND solution IS NOT NULL AND (${likeConditions})
         ORDER BY completedAt DESC LIMIT 5`,
        likeParams
      );

      // Search knowledge base
      const knowledgeLikeConditions = keywords.map(() => '(title LIKE ? OR problem LIKE ? OR solution LIKE ?)').join(' OR ');
      const knowledgeLikeParams = keywords.flatMap(k => [`%${k}%`, `%${k}%`, `%${k}%`]);
      const [knowledge] = await pool.query(
        `SELECT id, title, category, problem, solution FROM issue_knowledge 
         WHERE ${knowledgeLikeConditions}
         ORDER BY useCount DESC LIMIT 5`,
        knowledgeLikeParams
      );

      return { issues: issues as any[], knowledge: knowledge as any[] };
    }),

  // ============ Statistics ============

  getStats: protectedProcedure
    .input(z.object({
      period: z.enum(['week', 'month', 'quarter', 'year']).optional().default('month'),
    }))
    .query(async ({ input, ctx }) => {
      const pool = getPool();
      
      let dateFilter = '';
      switch (input.period) {
        case 'week': dateFilter = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)'; break;
        case 'month': dateFilter = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)'; break;
        case 'quarter': dateFilter = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 90 DAY)'; break;
        case 'year': dateFilter = 'AND createdAt >= DATE_SUB(NOW(), INTERVAL 365 DAY)'; break;
      }

      // Privacy filter for non-admin users
      const userId = (ctx as any).user?.id;
      const userRole = (ctx as any).user?.role;
      let privacyFilter = '';
      if (userRole !== 'admin' && userId) {
        privacyFilter = `AND (creatorId = ${Number(userId)} OR assigneeId = ${Number(userId)} OR helperId = ${Number(userId)})`;
      }

      // Status distribution
      const [statusDist] = await pool.query(
        `SELECT status, COUNT(*) as count FROM issues WHERE 1=1 ${dateFilter} ${privacyFilter} GROUP BY status`
      );

      // Category distribution
      const [categoryDist] = await pool.query(
        `SELECT category, COUNT(*) as count FROM issues WHERE 1=1 ${dateFilter} ${privacyFilter} GROUP BY category ORDER BY count DESC`
      );

      // Priority distribution
      const [priorityDist] = await pool.query(
        `SELECT priority, COUNT(*) as count FROM issues WHERE 1=1 ${dateFilter} ${privacyFilter} GROUP BY priority`
      );

      // Average resolution time (hours)
      const [avgResolution] = await pool.query(
        `SELECT AVG(TIMESTAMPDIFF(HOUR, createdAt, completedAt)) as avgHours 
         FROM issues WHERE completedAt IS NOT NULL ${dateFilter} ${privacyFilter}`
      );

      // Top assignees by workload
      const [assigneeStats] = await pool.query(
        `SELECT assigneeName, 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' OR status = 'closed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status IN ('pending', 'in_progress', 'waiting_confirm') THEN 1 ELSE 0 END) as active
         FROM issues WHERE assigneeName IS NOT NULL ${dateFilter} ${privacyFilter}
         GROUP BY assigneeId, assigneeName ORDER BY total DESC LIMIT 10`
      );

      // Daily trend (last 30 days)
      const [dailyTrend] = await pool.query(
        `SELECT DATE(createdAt) as date, COUNT(*) as created,
                SUM(CASE WHEN completedAt IS NOT NULL AND DATE(completedAt) = DATE(createdAt) THEN 1 ELSE 0 END) as resolved
         FROM issues WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${privacyFilter}
         GROUP BY DATE(createdAt) ORDER BY date`
      );

      // Overdue issues
      const [overdue] = await pool.query(
        `SELECT COUNT(*) as count FROM issues 
         WHERE deadline < NOW() AND status NOT IN ('completed', 'closed') ${privacyFilter}`
      );

      return {
        statusDistribution: statusDist as any[],
        categoryDistribution: categoryDist as any[],
        priorityDistribution: priorityDist as any[],
        avgResolutionHours: (avgResolution as any[])[0]?.avgHours || 0,
        assigneeStats: assigneeStats as any[],
        dailyTrend: dailyTrend as any[],
        overdueCount: (overdue as any[])[0]?.count || 0,
      };
    }),

  // ============ AI Features ============

  // AI suggest category and priority
  aiSuggest: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `あなたは問題分類の専門家です。問題のタイトルと説明から、最適なカテゴリと優先度を提案してください。

カテゴリ選択肢:
- operation: 運営関連（日常業務、プロセス、ワークフロー）
- technical: 技術関連（システム、バグ、開発）
- logistics: 物流関連（配送、在庫、倉庫）
- customer_service: カスタマーサービス（顧客対応、クレーム）
- finance: 財務関連（支払い、請求、経費）
- hr: 人事関連（採用、労務、研修）
- other: その他

優先度選択肢:
- urgent: 緊急（即座に対応が必要）
- high: 高（24時間以内に対応）
- medium: 中（今週中に対応）
- low: 低（余裕がある時に対応）`
            },
            {
              role: "user",
              content: `タイトル: ${input.title}\n説明: ${input.description || '(なし)'}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "issue_suggestion",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  category: { type: "string", enum: ["operation", "technical", "logistics", "customer_service", "finance", "hr", "other"] },
                  priority: { type: "string", enum: ["urgent", "high", "medium", "low"] },
                  reason: { type: "string", description: "提案理由の簡潔な説明" },
                },
                required: ["category", "priority", "reason"],
                additionalProperties: false,
              }
            }
          }
        });

        const content = response.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content);
        }
        return { category: 'other', priority: 'medium', reason: '自動分類できませんでした' };
      } catch (err) {
        return { category: 'other', priority: 'medium', reason: '自動分類できませんでした' };
      }
    }),

  // Delete knowledge entry
  deleteKnowledge: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query('DELETE FROM issue_knowledge WHERE id = ?', [input.id]);
      return { success: true };
    }),
});
