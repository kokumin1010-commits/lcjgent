/**
 * Migration: Create product_pipeline, product_test_assignment, product_lab_sales_data tables
 */
export async function createProductLabTables(db: any) {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS product_pipeline (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(500) NOT NULL,
        imageUrl TEXT,
        sourceUrl TEXT,
        sourceType ENUM('1688', 'aliexpress', 'manual') NOT NULL DEFAULT 'manual',
        costPrice DECIMAL(10, 2) NOT NULL DEFAULT 0,
        sellPrice DECIMAL(10, 2) NOT NULL DEFAULT 0,
        profitMargin DECIMAL(5, 2),
        status ENUM('candidate', 'testing', 'hit', 'spreading', 'standard', 'eliminated') NOT NULL DEFAULT 'candidate',
        score DECIMAL(8, 2) DEFAULT 0,
        totalSales INT DEFAULT 0,
        totalGmv DECIMAL(12, 2) DEFAULT 0,
        conversionRate DECIMAL(5, 2) DEFAULT 0,
        category VARCHAR(255),
        tags JSON,
        talkScript TEXT,
        productDescription TEXT,
        notes TEXT,
        createdBy INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS product_test_assignment (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        liverId INT NOT NULL,
        scheduledAt TIMESTAMP NULL,
        completedAt TIMESTAMP NULL,
        durationMinutes INT DEFAULT 5,
        lineNotifiedAt TIMESTAMP NULL,
        lineNotifyStatus ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
        salesCount INT DEFAULT 0,
        gmv DECIMAL(10, 2) DEFAULT 0,
        viewCount INT DEFAULT 0,
        conversionRate DECIMAL(5, 2) DEFAULT 0,
        notes TEXT,
        assignedBy INT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    await db.execute(`
      CREATE TABLE IF NOT EXISTS product_lab_sales_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productId INT NOT NULL,
        liverId INT,
        assignmentId INT,
        salesDate TIMESTAMP NULL,
        quantity INT DEFAULT 0,
        revenue DECIMAL(10, 2) DEFAULT 0,
        importedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        importSource VARCHAR(255),
        rawData JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("[Migration] Product Lab tables created successfully");
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log("[Migration] Product Lab tables already exist");
    } else {
      throw err;
    }
  }
}
