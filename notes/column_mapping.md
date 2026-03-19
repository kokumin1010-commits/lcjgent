# DB Column Name Mapping

## Problem
Drizzle schema uses camelCase for column names (e.g., `"liverId"`) but the actual DB columns are snake_case (e.g., `liver_id`).
This causes Drizzle to fail when querying because it generates SQL with camelCase column names that don't exist.

## Tables Affected

### liver_credits
| DB Column (actual) | Drizzle Schema (current) | Fix needed |
|---|---|---|
| liver_id | liverId | YES → "liver_id" |
| streaming_hours | streamingHours | YES → "streaming_hours" |
| monthly_sales | monthlySales | YES → "monthly_sales" |
| streaming_credit | streamingCredit | YES → "streaming_credit" |
| sales_credit | salesCredit | YES → "sales_credit" |
| rank_bonus | rankBonus | YES → "rank_bonus" |
| total_credit | totalCredit | YES → "total_credit" |
| used_credit | usedCredit | YES → "used_credit" |
| remaining_credit | remainingCredit | YES → "remaining_credit" |
| is_first_month | isFirstMonth | YES → "is_first_month" |
| carryover_credit | carryoverCredit | YES → "carryover_credit" |
| created_at | createdAt | YES → "created_at" |
| updated_at | updatedAt | YES → "updated_at" |

### sample_requests
| DB Column (actual) | Drizzle Schema (current) | Fix needed |
|---|---|---|
| liver_id | liverId | YES → "liver_id" |
| liver_name | liverName | YES → "liver_name" |
| scheduled_date | scheduledDate | YES → "scheduled_date" |
| total_amount | totalAmount | YES → "total_amount" |
| credit_used | creditUsed | YES → "credit_used" |
| out_of_pocket_amount | outOfPocketAmount | YES → "out_of_pocket_amount" |
| cash_amount | cashAmount | YES → "cash_amount" |
| admin_comment | adminComment | YES → "admin_comment" |
| reviewed_by | reviewedBy | YES → "reviewed_by" |
| reviewed_at | reviewedAt | YES → "reviewed_at" |
| shipped_at | shippedAt | YES → "shipped_at" |
| postal_code | postalCode | YES → "postal_code" |
| created_at | createdAt | YES → "created_at" |
| updated_at | updatedAt | YES → "updated_at" |

### sample_request_items
| DB Column (actual) | Drizzle Schema (current) | Fix needed |
|---|---|---|
| request_id | requestId | YES → "request_id" |
| product_id | mallProductId | YES → "product_id" |
| product_name | productName | YES → "product_name" |
| unit_price | price | YES → "unit_price" |
| created_at | createdAt | YES → "created_at" |
