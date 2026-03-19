# Finance API Error Analysis

## Error 1: getMonthlySummary - 500
```sql
select DATE_FORMAT(`orderCreatedAt`, '%Y-%m') as `month`, count(*), COALESCE(sum(`price`), 0), ...
from `tiktok_commission_orders` 
group by DATE_FORMAT(`tiktok_commission_orders`.`orderCreatedAt`, '%Y-%m') 
order by DATE_FORMAT(`tiktok_commission_orders`.`orderCreatedAt`, '%Y-%m') asc
```
Problem: GROUP BY uses backtick-quoted `tiktok_commission_orders`.`orderCreatedAt` but SELECT uses just `orderCreatedAt`.
TiDB may have issues with this inconsistency.

## Error 2: getDailySummary - 500
```sql
select DATE(`orderCreatedAt`) as `date`, count(*), ...
from `tiktok_commission_orders` 
group by DATE(`tiktok_commission_orders`.`orderCreatedAt`) 
order by DATE(`tiktok_commission_orders`.`orderCreatedAt`) asc
```
Same issue - GROUP BY/ORDER BY references table-qualified column but SELECT doesn't.

## Root Cause
The Drizzle ORM generates SQL with inconsistent column references.
When using `sql` template with column references, GROUP BY gets table-qualified names.
The actual SQL execution fails because TiDB's GROUP BY strict mode rejects this.

## Fix
Use raw SQL strings for GROUP BY/ORDER BY instead of Drizzle column references.
Or use `.as()` aliases consistently.
