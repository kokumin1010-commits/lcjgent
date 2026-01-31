import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { desc } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const result = await connection.query("SELECT id, title, liverName, startTime, endTime FROM schedules ORDER BY startTime DESC LIMIT 30");
console.log(JSON.stringify(result[0], null, 2));

await connection.end();
