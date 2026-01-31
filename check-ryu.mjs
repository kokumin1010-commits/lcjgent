import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const result = await connection.query("SELECT id, title, liverName, startTime, endTime FROM schedules WHERE id IN (120001, 120002)");
console.log(JSON.stringify(result[0], null, 2));
await connection.end();
