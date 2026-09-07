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

async function withNamedReceiptLock<T>(lockName: string, busyMessage: string, work: () => Promise<T>): Promise<T> {
  const connection = await getPass2Pool().getConnection();
  let acquired = false;

  try {
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT GET_LOCK(?, 0) AS acquired",
      [lockName]
    );
    acquired = Number((rows[0] as LockRow | undefined)?.acquired) === 1;
    if (!acquired) throw new Error(busyMessage);
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

export async function withPass2GlobalLock<T>(work: () => Promise<T>): Promise<T> {
  return withNamedReceiptLock(
    "lcj_receipt_pass2_v2_global",
    "Another Pass 2 batch is already running",
    work,
  );
}

export async function withHumanLearningReviewLock<T>(logId: number, work: () => Promise<T>): Promise<T> {
  if (!Number.isSafeInteger(logId)) throw new Error("Invalid human learning review log ID");
  return withNamedReceiptLock(
    `lcj_receipt_learning_${logId}`,
    "This learning review is already being processed",
    work,
  );
}
