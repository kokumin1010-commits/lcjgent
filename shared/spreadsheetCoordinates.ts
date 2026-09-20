export function spreadsheetColumnName(column: number): string {
  let value = Math.max(1, Math.trunc(column));
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
