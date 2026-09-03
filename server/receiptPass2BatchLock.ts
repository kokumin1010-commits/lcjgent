import mysql from "mysql2/promise";

let pass2Pool: mysql.Pool | null = null;

function getPass2Pool(): mysql.Pool {
  if (!pass2Pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for Pass 2 execution");
    pass2Pool = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: 2,
      waitForConnections: true,
      queueLimit: 10,
      enableKeepAlive: true,
    });
  }
  return pass2Pool;
}

type LockRow = { acquired: number | string | null };

export async function withPass2GlobalLock<T>(work: () => Promise<T>): Promise<T> {
  const connection = await getPass2Pool().getConnection();
  const lockName = "lcj_receipt_pass2_v2_global";
  let acquired = false;

  try {
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT GET_LOCK(?, 0) AS acquired",
      [lockName]
    );
    acquired = Number((rows[0] as LockRow | undefined)?.acquired) === 1;
    if (!acquired) {
      throw new Error("Another Pass 2 batch is already running");
    }
    return await work();
  } finally {
    if (acquired) {
      try {
        await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
      } catch {
        // Closing the connection also releases the named lock.
      }
    }
    connection.release();
  }
}
