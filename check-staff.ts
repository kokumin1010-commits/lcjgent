import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = mysql.createPool(process.env.DATABASE_URL as string);

async function main() {
  const [tables] = await pool.query('SHOW TABLES');
  const tableList = (tables as any[]).map(t => Object.values(t)[0] as string);
  console.log("Tables with 'staff':", tableList.filter(t => t.toLowerCase().includes('staff')));
  
  // Check staff table
  const [staffZhang] = await pool.query("SELECT id, name, email, department, position, isActive, country, resignDate FROM staff WHERE name LIKE '%章子悦%'");
  console.log("\n=== staff (章子悦) ===");
  console.log(staffZhang);

  // Check all staff that are active
  const [activeStaff] = await pool.query("SELECT id, name, department, position, isActive, country FROM staff WHERE isActive = 'active' ORDER BY country, department");
  console.log("\n=== All active staff ===");
  console.log(activeStaff);

  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
