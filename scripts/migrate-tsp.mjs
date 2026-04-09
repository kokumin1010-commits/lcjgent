import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function migrate() {
  const connection = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: true }
  });
  
  console.log('Creating tsp_contracts table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tsp_contracts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      shopName VARCHAR(255) NOT NULL,
      companyName VARCHAR(255),
      contactName VARCHAR(255),
      contactEmail VARCHAR(320) NOT NULL,
      contactPhone VARCHAR(50),
      postalCode VARCHAR(20),
      address TEXT,
      monthlyAmount INT NOT NULL,
      taxRate INT NOT NULL DEFAULT 10,
      contractStartDate TIMESTAMP NOT NULL,
      contractEndDate TIMESTAMP NULL,
      billingDay INT NOT NULL DEFAULT 1,
      paymentDueDays INT NOT NULL DEFAULT 30,
      paymentMethod VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
      description TEXT,
      stripeCustomerId VARCHAR(255),
      stripeSubscriptionId VARCHAR(255),
      stripePriceId VARCHAR(255),
      stripeProductId VARCHAR(255),
      tapShopName VARCHAR(255),
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ tsp_contracts created');

  console.log('Creating tsp_invoices table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tsp_invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      contractId INT NOT NULL,
      invoiceNumber VARCHAR(100),
      billingMonth VARCHAR(7) NOT NULL,
      amount INT NOT NULL,
      taxAmount INT NOT NULL,
      totalAmount INT NOT NULL,
      description TEXT,
      dueDate TIMESTAMP NULL,
      stripeInvoiceId VARCHAR(255),
      stripeInvoiceUrl TEXT,
      stripeInvoicePdf TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      paidAt TIMESTAMP NULL,
      sentAt TIMESTAMP NULL,
      notes TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_contractId (contractId),
      INDEX idx_billingMonth (billingMonth),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ tsp_invoices created');

  await connection.end();
  console.log('Migration completed successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
