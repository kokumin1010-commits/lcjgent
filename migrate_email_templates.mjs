import mysql from "mysql2/promise";

const DATABASE_URL = "mysql://ViCMbGRGvoSuVwV.root:yee376welv03EMyc1Vku@gateway03.us-east-1.prod.aws.tidbcloud.com:4000/GgA9WvTBCZMf6mjyMMwACw";

async function migrate() {
  const conn = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connected to DB");

  // 1. recruitment_email_templates
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS recruitment_email_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      subject VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      variables TEXT,
      isDefault BOOLEAN NOT NULL DEFAULT false,
      sortOrder INT NOT NULL DEFAULT 0,
      createdBy VARCHAR(100),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("✅ recruitment_email_templates created");

  // 2. email_signatures
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS email_signatures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      content TEXT NOT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT false,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("✅ email_signatures created");

  // 3. recruitment_email_logs
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS recruitment_email_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      brandId INT NOT NULL,
      templateId INT,
      toAddress VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      sentBy VARCHAR(100),
      sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      isBulk BOOLEAN NOT NULL DEFAULT false
    )
  `);
  console.log("✅ recruitment_email_logs created");

  // Insert default templates
  const [existing] = await conn.execute("SELECT COUNT(*) as cnt FROM recruitment_email_templates");
  if (existing[0].cnt === 0) {
    await conn.execute(`
      INSERT INTO recruitment_email_templates (name, category, subject, body, variables, isDefault, sortOrder) VALUES
      ('初回連絡', 'first_contact', '【LCJ MALL】{{brandName}}様へのご提案', '{{brandName}}様\n\nはじめまして。LCJ MALL（ライブコマースジャパン）の{{senderName}}と申します。\n\n貴社のブランドに大変興味を持ち、ご連絡させていただきました。\n\n弊社はTikTok Shopと連携したECモール「LCJ MALL」を運営しており、ライブコマースを通じた新しい販売チャネルをご提供しております。\n\nぜひ一度、詳細をご説明させていただければ幸いです。\nご都合の良い日時をお知らせいただけますでしょうか。\n\nよろしくお願いいたします。', '["brandName","senderName","companyName"]', true, 1),
      ('フォローアップ', 'follow_up', '【LCJ MALL】{{brandName}}様 - フォローアップのご連絡', '{{brandName}}様\n\nお世話になっております。LCJ MALLの{{senderName}}です。\n\n先日ご連絡させていただいた件について、その後いかがでしょうか。\n\nご不明な点やご質問がございましたら、お気軽にお問い合わせください。\n\n改めてご検討いただけますと幸いです。\n\nよろしくお願いいたします。', '["brandName","senderName"]', false, 2),
      ('提案書送付', 'proposal', '【LCJ MALL】{{brandName}}様 - ご提案資料のご送付', '{{brandName}}様\n\nお世話になっております。LCJ MALLの{{senderName}}です。\n\n先日お話しさせていただいた内容を踏まえ、ご提案資料をお送りいたします。\n\n資料をご確認いただき、ご質問やご要望がございましたらお気軽にお申し付けください。\n\n次回のお打ち合わせの日程調整もさせていただければ幸いです。\n\nよろしくお願いいたします。', '["brandName","senderName"]', false, 3),
      ('お礼メール', 'thank_you', '【LCJ MALL】{{brandName}}様 - お打ち合わせのお礼', '{{brandName}}様\n\nお世話になっております。LCJ MALLの{{senderName}}です。\n\n本日はお忙しい中、お時間をいただきありがとうございました。\n\nお打ち合わせでお話しした内容を踏まえ、引き続き進めてまいります。\n\n何かございましたら、いつでもご連絡ください。\n\n今後ともよろしくお願いいたします。', '["brandName","senderName"]', false, 4),
      ('契約確認', 'contract', '【LCJ MALL】{{brandName}}様 - ご契約内容の確認', '{{brandName}}様\n\nお世話になっております。LCJ MALLの{{senderName}}です。\n\nこの度は弊社との契約にご同意いただき、誠にありがとうございます。\n\n契約内容の確認事項をお送りいたしますので、ご確認をお願いいたします。\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\nよろしくお願いいたします。', '["brandName","senderName"]', false, 5)
    `);
    console.log("✅ Default templates inserted");
  }

  // Insert default signature
  const [sigExisting] = await conn.execute("SELECT COUNT(*) as cnt FROM email_signatures");
  if (sigExisting[0].cnt === 0) {
    await conn.execute(`
      INSERT INTO email_signatures (name, content, isDefault) VALUES
      ('標準署名', '---\nLCJ MALL（ライブコマースジャパン）\nLive Commerce Japan Inc.\nEmail: lcj.inquiry@livecommercejapan.jp\nWebsite: https://lcjmall.com\n---', true)
    `);
    console.log("✅ Default signature inserted");
  }

  await conn.end();
  console.log("✅ Migration complete");
}

migrate().catch(console.error);
