import * as XLSX from "xlsx";

interface ColumnConfig {
  key: string;
  title: string;
  render?: (value: unknown, row: Record<string, unknown>) => string;
}

function formatSheetName(name: string): string {
  return name.replace(/[\\\/\*\?\[\]:]/g, "").substring(0, 31);
}

function autoFitColumns(ws: XLSX.WorkSheet, headers: string[]) {
  const colWidths = headers.map((header) => {
    const headerLen = (header || "").length;
    return { wch: Math.max(headerLen * 3 + 4, 12) };
  });
  ws["!cols"] = colWidths;
}

export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ColumnConfig[],
  filename: string,
  sheetName: string = "Sheet1"
) {
  const rows = data.map((row) => {
    const obj: Record<string, string> = {};
    for (const col of columns) {
      const value = row[col.key];
      obj[col.title] = col.render ? col.render(value, row) : (value != null ? String(value) : "");
    }
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = columns.map((c) => c.title);
  autoFitColumns(ws, headers);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, formatSheetName(sheetName));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportMultiSheet(
  sheets: { data: Record<string, unknown>[]; columns: ColumnConfig[]; sheetName: string }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const rows = sheet.data.map((row) => {
      const obj: Record<string, string> = {};
      for (const col of sheet.columns) {
        const value = row[col.key];
        obj[col.title] = col.render ? col.render(value, row) : (value != null ? String(value) : "");
      }
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = sheet.columns.map((c) => c.title);
    autoFitColumns(ws, headers);
    XLSX.utils.book_append_sheet(wb, ws, formatSheetName(sheet.sheetName));
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
