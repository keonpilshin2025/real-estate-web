import * as XLSX from "xlsx";

/**
 * rows: API에서 받은 원본 데이터 배열
 * columns: [{ key: "property_name", label: "매물명", format?: (value, row) => string }]
 * filename: "매물목록_2026-07-20.xlsx" 형태
 */
export function exportToExcel(rows, columns, filename) {
  const data = (rows || []).map((row) => {
    const obj = {};
    columns.forEach(({ key, label, format }) => {
      const raw = row[key];
      obj[label] = format ? format(raw, row) : raw ?? "";
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename);
}

export function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}