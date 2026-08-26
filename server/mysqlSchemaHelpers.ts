type MysqlQueryable = {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
};

type ColumnDefinition = {
  name: string;
  definition: string;
};

type IndexDefinition = {
  name: string;
  columns: string[];
};

function mysqlIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe MySQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

export async function ensureMysqlColumns(
  connection: MysqlQueryable,
  tableName: string,
  columns: ColumnDefinition[],
): Promise<string[]> {
  const table = mysqlIdentifier(tableName);
  const [rows] = await connection.query(`SHOW COLUMNS FROM ${table}`) as any;
  const existing = new Set((rows || []).map((row: any) => String(row.Field)));
  const added: string[] = [];

  for (const column of columns) {
    if (existing.has(column.name)) continue;
    await connection.query(
      `ALTER TABLE ${table} ADD COLUMN ${mysqlIdentifier(column.name)} ${column.definition}`,
    );
    existing.add(column.name);
    added.push(column.name);
  }
  return added;
}

export async function ensureMysqlIndexes(
  connection: MysqlQueryable,
  tableName: string,
  indexes: IndexDefinition[],
): Promise<string[]> {
  const table = mysqlIdentifier(tableName);
  const [rows] = await connection.query(`SHOW INDEX FROM ${table}`) as any;
  const existing = new Set((rows || []).map((row: any) => String(row.Key_name)));
  const added: string[] = [];

  for (const index of indexes) {
    if (existing.has(index.name)) continue;
    const columns = index.columns.map(mysqlIdentifier).join(", ");
    await connection.query(
      `CREATE INDEX ${mysqlIdentifier(index.name)} ON ${table} (${columns})`,
    );
    existing.add(index.name);
    added.push(index.name);
  }
  return added;
}
