const ExcelJS = require("exceljs");

/**
 * Streams an Excel workbook of `rows` (plain objects) to the response.
 * `columns` = [{ header: 'Branch Name', key: 'branchName', width: 25 }, ...]
 */
async function exportToExcel(res, { sheetName, columns, rows, filename }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Parses an uploaded .xlsx buffer into an array of plain row objects,
 * keyed by the header row. Used for "Import from Excel".
 */
async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1).values; // 1-indexed, [0] empty
  const headers = headerRow.slice(1).map((h) => String(h).trim());

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] !== undefined ? values[i] : "";
    });
    rows.push(obj);
  });
  return rows;
}

module.exports = { exportToExcel, parseExcelBuffer };
