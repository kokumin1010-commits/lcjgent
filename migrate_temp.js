const mysql = require('mysql2/promise');

const DB_URL = "mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw";

const sqls = [
  `CREATE TABLE IF NOT EXISTS \`blog_article_seo_metrics\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`articleId\` int NOT NULL,
    \`slug\` varchar(255) NOT NULL,
    \`impressions\` int NOT NULL DEFAULT 0,
    \`clicks\` int NOT NULL DEFAULT 0,
    \`ctr\` decimal(6,4) DEFAULT '0.0000',
    \`avgPosition\` decimal(6,2) DEFAULT '0.00',
    \`isIndexed\` boolean NOT NULL DEFAULT false,
    \`indexedAt\` timestamp NULL,
    \`lastCheckedAt\` timestamp NULL,
    \`periodStart\` timestamp NULL,
    \`periodEnd\` timestamp NULL,
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`blog_article_stats\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`articleId\` int NOT NULL,
    \`mallClicks\` int NOT NULL DEFAULT 0,
    \`productClicks\` int NOT NULL DEFAULT 0,
    \`bannerClicks\` int NOT NULL DEFAULT 0,
    \`bannerImpressions\` int NOT NULL DEFAULT 0,
    \`titlePattern\` varchar(50),
    \`articleType\` varchar(30),
    \`categorySlug\` varchar(100),
    \`internalLinkCount\` int DEFAULT 0,
    \`qualityScore\` int DEFAULT 0,
    \`rewriteCount\` int NOT NULL DEFAULT 0,
    \`lastRewriteAt\` timestamp NULL,
    \`rewriteReason\` varchar(255),
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`blog_article_stats_articleId_unique\` (\`articleId\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`blog_article_theme_log\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`articleId\` int NOT NULL,
    \`categorySlug\` varchar(100) NOT NULL,
    \`problemType\` varchar(100),
    \`articleType\` varchar(30) NOT NULL,
    \`keyword\` varchar(255),
    \`titlePattern\` varchar(50),
    \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`)
  )`,
  `ALTER TABLE \`blog_articles\` ADD COLUMN IF NOT EXISTS \`titlePattern\` varchar(32)`,
  `ALTER TABLE \`blog_articles\` ADD COLUMN IF NOT EXISTS \`articleTheme\` text`,
];

async function main() {
  const conn = await mysql.createConnection({
    uri: DB_URL,
    ssl: { rejectUnauthorized: true }
  });
  
  for (const sql of sqls) {
    try {
      await conn.execute(sql);
      console.log('OK:', sql.substring(0, 60) + '...');
    } catch (e) {
      console.error('ERR:', e.message, sql.substring(0, 60));
    }
  }
  
  await conn.end();
  console.log('Migration complete!');
}

main().catch(console.error);
