import mysql, { type Pool } from "mysql2/promise";

let poolInstance: Pool | null = null;

export async function getStoreProductPool(): Promise<Pool> {
  if (poolInstance) return poolInstance;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  poolInstance = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
  });
  return poolInstance;
}
