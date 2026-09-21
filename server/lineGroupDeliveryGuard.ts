import { eq } from "drizzle-orm";
import { lineGroupLifecycleStates, lineGroups } from "../drizzle/schema";
import { getDb } from "./db";

export async function canDeliverLineGroupPush(lineGroupId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("LINE_GROUP_DELIVERY_GUARD_DB_UNAVAILABLE");

  const [state] = await db
    .select({
      isActive: lineGroups.isActive,
      lifecycleIsActive: lineGroupLifecycleStates.isActive,
    })
    .from(lineGroups)
    .leftJoin(
      lineGroupLifecycleStates,
      eq(lineGroupLifecycleStates.lineGroupId, lineGroups.lineGroupId),
    )
    .where(eq(lineGroups.lineGroupId, lineGroupId))
    .limit(1);

  return Boolean(
    state?.isActive &&
    (state.lifecycleIsActive === null || state.lifecycleIsActive === undefined || state.lifecycleIsActive),
  );
}
