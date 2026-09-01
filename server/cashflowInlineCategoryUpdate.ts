import { TRPCError } from "@trpc/server";

export type CashflowInlineCategoryConnection = {
  beginTransaction: () => Promise<unknown>;
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
  commit: () => Promise<unknown>;
  rollback: () => Promise<unknown>;
  release: () => void;
};

export type CashflowInlineCategoryPool = {
  getConnection: () => Promise<CashflowInlineCategoryConnection>;
};

type Actor = {
  id: number;
  name?: string | null;
  email?: string | null;
};

type CategoryCorrection = {
  cashflowId: number;
  fromCategory: string | null;
  toCategory: string;
  aiCategory: string | null;
  counterparty: string | null;
  description: string | null;
  actorId: number;
  actorName: string;
};

export type CashflowInlineCategoryUpdateDependencies = {
  assertCategoryAllowed: (
    connection: CashflowInlineCategoryConnection,
    category: string,
    flowType: "income" | "expense"
  ) => Promise<unknown>;
  isPayrollCategory: (category: string | null | undefined) => boolean;
  requirePayrollAccess: () => Promise<unknown>;
  recordCategoryCorrection: (
    connection: CashflowInlineCategoryConnection,
    correction: CategoryCorrection
  ) => Promise<unknown>;
};

export async function applyCashflowInlineCategoryUpdate(params: {
  pool: CashflowInlineCategoryPool;
  id: number;
  category: string;
  actor: Actor;
  dependencies: CashflowInlineCategoryUpdateDependencies;
}) {
  const category = params.category.trim();
  const connection = await params.pool.getConnection();
  let oldData: any = null;

  try {
    await connection.beginTransaction();
    const [oldRows] = (await connection.query(
      "SELECT * FROM company_cashflows WHERE id = ? FOR UPDATE",
      [params.id]
    )) as any;
    oldData = oldRows?.[0];

    if (!oldData || oldData.deletedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "流水不存在" });
    }

    if (
      params.dependencies.isPayrollCategory(category) ||
      params.dependencies.isPayrollCategory(oldData.category) ||
      oldData.payrollRecordKey ||
      oldData.payrollMonth ||
      oldData.payrollEmployee
    ) {
      await params.dependencies.requirePayrollAccess();
    }

    await params.dependencies.assertCategoryAllowed(
      connection,
      category,
      oldData.type
    );

    const changed = category !== oldData.category;
    if (changed) {
      await connection.query(
        `UPDATE company_cashflows
            SET category = ?, categorySource = 'manual', categoryLockedByUser = 1,
                categoryConfidence = NULL, categoryReason = '人工修正AI/规则分类',
                lastClassifiedAt = NOW(), categoryUpdatedBy = ?
          WHERE id = ? AND deletedAt IS NULL`,
        [category, params.actor.id, params.id]
      );

      await params.dependencies.recordCategoryCorrection(connection, {
        cashflowId: params.id,
        fromCategory: oldData.category || null,
        toCategory: category,
        aiCategory: String(oldData.categorySource || "").startsWith("ai_")
          ? oldData.category
          : null,
        counterparty: oldData.counterparty ?? null,
        description: oldData.description ?? null,
        actorId: params.actor.id,
        actorName: params.actor.name || params.actor.email || "unknown",
      });
    }

    await connection.commit();
    return {
      success: true as const,
      changed,
      category,
      before: {
        category: oldData.category ?? null,
        categorySource: oldData.categorySource ?? null,
        categoryLockedByUser: Number(oldData.categoryLockedByUser || 0),
      },
      after: changed
        ? {
            category,
            categorySource: "manual",
            categoryLockedByUser: 1,
          }
        : {
            category: oldData.category ?? category,
            categorySource: oldData.categorySource ?? null,
            categoryLockedByUser: Number(oldData.categoryLockedByUser || 0),
          },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
