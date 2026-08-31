import * as XLSX from "xlsx";

export type CompetitorWorkbookRow = Record<string, unknown>;

function hasCellValue(cell: XLSX.CellObject | undefined) {
  return (
    cell?.v !== undefined && cell.v !== null && String(cell.v).trim() !== ""
  );
}

/**
 * Kalodata workbooks commonly merge shop-level columns across several product rows.
 * SheetJS only exposes the top-left merged cell, so expand values strictly inside
 * declared merge ranges before converting the sheet to row objects.
 */
export function expandDeclaredMergedCells(
  sheet: XLSX.WorkSheet
): XLSX.WorkSheet {
  const expanded: XLSX.WorkSheet = { ...sheet };
  const merges = sheet["!merges"] || [];

  for (const merge of merges) {
    const sourceAddress = XLSX.utils.encode_cell(merge.s);
    const sourceCell = sheet[sourceAddress] as XLSX.CellObject | undefined;
    if (!hasCellValue(sourceCell)) continue;

    for (let row = merge.s.r; row <= merge.e.r; row += 1) {
      for (let column = merge.s.c; column <= merge.e.c; column += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: column });
        const current = sheet[address] as XLSX.CellObject | undefined;
        if (!hasCellValue(current)) expanded[address] = { ...sourceCell };
      }
    }
  }

  return expanded;
}

export function competitorSheetToRows(
  sheet: XLSX.WorkSheet,
  sheetName: string
): CompetitorWorkbookRow[] {
  const expanded = expandDeclaredMergedCells(sheet);
  const rows = XLSX.utils.sheet_to_json<CompetitorWorkbookRow>(expanded, {
    defval: null,
    raw: true,
  });
  return rows.map(row => ({ ...row, __sheetName: sheetName }));
}
