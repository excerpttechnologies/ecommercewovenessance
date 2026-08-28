const PDFDocument = require("pdfkit");

/**
 * Streams a simple tabular PDF report to the response.
 * columns = [{ header: 'Branch Name', key: 'branchName', width: 150 }, ...]
 */
function exportToPdf(res, { title, columns, rows, filename }) {
  const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).text(title, { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor("#555").text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(1);

  const startX = doc.x;
  let y = doc.y;
  const rowHeight = 20;

  const drawHeader = () => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
    let x = startX;
    columns.forEach((col) => {
      doc.text(col.header, x, y, { width: col.width, ellipsis: true });
      x += col.width;
    });
    y += rowHeight;
    doc.moveTo(startX, y - 4).lineTo(x, y - 4).strokeColor("#ccc").stroke();
  };

  drawHeader();
  doc.font("Helvetica").fontSize(9).fillColor("#222");

  rows.forEach((row) => {
    if (y > doc.page.height - 60) {
      doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
      y = doc.y;
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor("#222");
    }
    let x = startX;
    columns.forEach((col) => {
      const val = row[col.key] === undefined || row[col.key] === null ? "" : String(row[col.key]);
      doc.text(val, x, y, { width: col.width, ellipsis: true });
      x += col.width;
    });
    y += rowHeight;
  });

  doc.end();
}

module.exports = { exportToPdf };
