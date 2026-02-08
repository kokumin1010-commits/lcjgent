# ad_campaigns テーブル：DB実テーブル vs Drizzleスキーマの差分

## DB実テーブル（本番）
| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | int(11) | NO | auto_increment |
| brandId | int(11) | NO | - |
| campaignName | varchar(255) | NO | - |
| platform | varchar(100) | NO | - |
| startDate | timestamp | NO | - |
| endDate | timestamp | NO | - |
| budget | bigint(20) | NO | - |
| currency | varchar(10) | NO | JPY |
| objective | enum('impression','click','conversion','engagement','other') | NO | impression |
| objectiveConfidence | decimal(5,2) | YES | - |
| reportLanguage | enum('ja','zh','en') | NO | ja |
| reportFileUrl | text | YES | - |
| reportFileKey | varchar(512) | YES | - |
| status | enum('active','completed','paused','cancelled') | NO | active |
| memo | text | YES | - |
| createdBy | int(11) | NO | - |
| createdAt | timestamp | NO | CURRENT_TIMESTAMP |
| updatedAt | timestamp | NO | CURRENT_TIMESTAMP on update |

## Drizzleスキーマ（コード）
| Column | Type | Nullable |
|--------|------|----------|
| id | int | NO |
| brandId | int | NO |
| name | varchar(255) | NO |
| platform | enum('tiktok','facebook','instagram','google','youtube','other') | NO |
| objective | enum('impressions','clicks','conversions','awareness','engagement') | NO |
| objectiveConfidence | int | YES |
| startDate | timestamp | YES |
| endDate | timestamp | YES |
| budget | bigint | YES |
| actualSpend | bigint | YES |
| status | enum('draft','active','paused','completed') | NO |
| detectedLanguage | varchar(10) | YES |
| sourceFileUrl | text | YES |
| sourceFileKey | varchar(512) | YES |
| rawData | json | YES |
| createdBy | int | NO |
| createdByName | varchar(255) | NO |
| createdAt | timestamp | NO |
| updatedAt | timestamp | NO |

## 主な差分
1. **campaignName vs name** - カラム名が違う
2. **platform** - DB: varchar(100), Schema: enum with different values
3. **objective** - DB: enum('impression','click','conversion','engagement','other'), Schema: enum('impressions','clicks','conversions','awareness','engagement') - 値が違う
4. **startDate/endDate** - DB: NOT NULL, Schema: nullable
5. **budget** - DB: NOT NULL, Schema: nullable
6. **currency** - DBにあるがスキーマにない
7. **reportLanguage** - DBにあるがスキーマにない (vs detectedLanguage)
8. **reportFileUrl/Key** - DBにあるがスキーマにない (vs sourceFileUrl/Key)
9. **memo** - DBにあるがスキーマにない
10. **actualSpend** - スキーマにあるがDBにない
11. **rawData** - スキーマにあるがDBにない
12. **createdByName** - スキーマにあるがDBにない
13. **status** - DB: enum('active','completed','paused','cancelled'), Schema: enum('draft','active','paused','completed')
