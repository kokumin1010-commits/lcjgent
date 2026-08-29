export function buildCashflowMonthRange(value: string): { year: number; month: number; start: string; end: string } | null {
  const match = value.match(/^(20\d{2})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    year,
    month,
    start: `${value}-01`,
    end: `${value}-${String(lastDay).padStart(2, "0")}`,
  };
}
