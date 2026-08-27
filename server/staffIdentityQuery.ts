import { and, eq, isNull } from "drizzle-orm";
import { staff } from "../drizzle/schema";

/** Current employee source of truth for every live selector and roster. */
export function currentStaffCondition() {
  return and(
    eq(staff.isActive, "active"),
    isNull(staff.archivedAt),
    isNull(staff.mergedIntoStaffId),
  );
}

/** Non-archived canonical HR records, including inactive/resigned staff. */
export function visibleCanonicalStaffCondition() {
  return and(
    isNull(staff.archivedAt),
    isNull(staff.mergedIntoStaffId),
  );
}
