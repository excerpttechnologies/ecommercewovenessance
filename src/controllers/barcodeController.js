const asyncHandler = require("express-async-handler");
const bwipjs = require("bwip-js");
const PDFDocument = require("pdfkit");
const Item = require("../models/Item");
const { assertBranchAccess } = require("../middleware/branchScope");

/**
 * Barcode rendering.
 *
 * The item's barcode NUMBER is generated at create time and locked; this turns
 * that number into something a scanner can read — a PNG for the screen, and an
 * A4 sheet of labels for a sticker printer.
 *
 * Nothing is stored. Rendering is deterministic from the item, so caching an
 * image file would only create a second thing to keep in sync with the record.
 */

/** Our symbology names → the bcid strings bwip-js expects. */
const SYMBOLOGY_TO_BCID = {
  "EAN-13": "ean13",
  "EAN-8": "ean8",
  "UPC-A": "upca",
  "UPC-E": "upce",
  "Code-128": "code128",
  "Code-39": "code39",
  "ITF-14": "itf14",
  GS1: "gs1-128",
  "QR Code": "qrcode",
};

/**
 * Renders a barcode PNG.
 *
 * bwip-js REFUSES a value that doesn't satisfy its symbology — an EAN-13 with a
 * wrong check digit throws rather than drawing something a scanner would
 * misread. That strictness is right, but it must not leave the admin with a
 * broken image: anything the chosen symbology rejects falls back to Code-128,
 * which encodes arbitrary text. A silently wrong barcode on a printed sticker
 * is far worse than a differently-shaped correct one.
 */
async function renderBarcode({ text, symbology, scale = 3, height = 12, includetext = true }) {
  const preferred = SYMBOLOGY_TO_BCID[symbology] || "code128";

  const opts = {
    bcid: preferred,
    text: String(text),
    scale,
    height,
    includetext,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
    paddingwidth: 4,
    paddingheight: 4,
  };

  try {
    return { png: await bwipjs.toBuffer(opts), symbology, fellBack: false };
  } catch (err) {
    if (preferred === "code128") throw err; // nothing left to fall back to

    console.warn(
      `[barcode] "${text}" is not a valid ${symbology} (${err.message}) — rendering as Code-128 instead.`
    );
    return {
      png: await bwipjs.toBuffer({ ...opts, bcid: "code128" }),
      symbology: "Code-128",
      fellBack: true,
    };
  }
}

/** Loads an item for barcode work, honouring branch scoping. */
async function loadItem(req) {
  const item = await Item.findOne({ _id: req.params.id, isDeleted: { $ne: true } })
    .select(
      "identity.barcode identity.itemCode identity.productName identity.displayName " +
        "barcodeManagement pricing.sellingPrice pricing.currency branch"
    )
    .lean();

  if (!item) {
    const err = new Error("Item not found");
    err.statusCode = 404;
    throw err;
  }
  assertBranchAccess(req, item, "Item");

  // barcodeManagement.internalBarcode mirrors identity.barcode, but identity is
  // the locked original — prefer it, and let a supplier barcode stand in when
  // the item predates auto-generation.
  const value =
    item.identity?.barcode ||
    item.barcodeManagement?.internalBarcode ||
    item.barcodeManagement?.barcodeNumber ||
    item.barcodeManagement?.supplierBarcode ||
    item.identity?.itemCode;

  if (!value) {
    const err = new Error("This item has no barcode or item code to print");
    err.statusCode = 409;
    throw err;
  }

  return { item, value };
}

// GET /api/woven-essence/items/:id/barcode.png?scale=&height=&text=0
// Used by the item form's live preview and by anything that wants the image.
const barcodePng = asyncHandler(async (req, res) => {
  const { item, value } = await loadItem(req);

  const { png, symbology, fellBack } = await renderBarcode({
    text: value,
    symbology: item.barcodeManagement?.symbology || "EAN-13",
    scale: Math.min(Math.max(parseInt(req.query.scale, 10) || 3, 1), 8),
    height: Math.min(Math.max(parseInt(req.query.height, 10) || 12, 5), 40),
    includetext: req.query.text !== "0",
  });

  res.type("png");
  // Told to the client rather than hidden, so the form can warn that the stored
  // number doesn't fit the symbology the admin picked.
  res.set("X-Barcode-Symbology", symbology);
  if (fellBack) res.set("X-Barcode-Fallback", "1");
  // The number is immutable, so the image for a given set of options is too.
  res.set("Cache-Control", "private, max-age=3600");
  res.send(png);
});

/* ── printable label sheets ──────────────────────────────────────────────── */

/** A4 at 72dpi, with a 3-across × 8-down grid — standard sticker stationery. */
const SHEET = {
  width: 595.28,
  height: 841.89,
  marginX: 28,
  marginY: 28,
  cols: 3,
  rows: 8,
  gutterX: 10,
  gutterY: 8,
};

const MAX_LABELS = 500;

// GET /api/woven-essence/items/:id/labels.pdf?qty=
// A sheet of identical labels for one item: name, item code, price, barcode.
const labelsPdf = asyncHandler(async (req, res) => {
  const { item, value } = await loadItem(req);

  const requested =
    parseInt(req.query.qty, 10) || item.barcodeManagement?.printQty || 1;
  const qty = Math.min(Math.max(requested, 1), MAX_LABELS);

  const { png, fellBack, symbology } = await renderBarcode({
    text: value,
    symbology: item.barcodeManagement?.symbology || "EAN-13",
    // Rendered once at high scale and reused for every label on the sheet:
    // re-rendering per sticker would be 500 identical encodes.
    scale: 4,
    height: 14,
    includetext: false, // the number is typeset below, so it stays crisp
  });

  const name = item.identity?.displayName || item.identity?.productName || "Saree";
  const code = item.identity?.itemCode || "";
  const price = item.pricing?.sellingPrice;

  const doc = new PDFDocument({ size: "A4", margin: 0 });

  res.type("pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="labels-${(code || value).replace(/[^A-Za-z0-9-]/g, "")}.pdf"`
  );
  doc.pipe(res);

  const cellW =
    (SHEET.width - SHEET.marginX * 2 - SHEET.gutterX * (SHEET.cols - 1)) / SHEET.cols;
  const cellH =
    (SHEET.height - SHEET.marginY * 2 - SHEET.gutterY * (SHEET.rows - 1)) / SHEET.rows;
  const perPage = SHEET.cols * SHEET.rows;

  for (let i = 0; i < qty; i += 1) {
    const onPage = i % perPage;
    if (i > 0 && onPage === 0) doc.addPage({ size: "A4", margin: 0 });

    const col = onPage % SHEET.cols;
    const row = Math.floor(onPage / SHEET.cols);
    const x = SHEET.marginX + col * (cellW + SHEET.gutterX);
    const y = SHEET.marginY + row * (cellH + SHEET.gutterY);

    // Cut guide, deliberately hairline and grey so it disappears on cheap
    // sticker stock rather than printing a heavy black box.
    doc.save().lineWidth(0.3).strokeColor("#CCCCCC").rect(x, y, cellW, cellH).stroke().restore();

    const pad = 5;
    let cursor = y + pad;

    doc.fontSize(7).fillColor("#111111").font("Helvetica-Bold");
    doc.text(name, x + pad, cursor, { width: cellW - pad * 2, height: 16, ellipsis: true, lineGap: -1 });
    cursor += 15;

    if (price != null) {
      // "Rs." rather than the rupee sign: PDFKit's built-in Helvetica has no
      // glyph for U+20B9 and DROPS it silently, so the first render of this
      // sheet printed a bare "18,500". The invoice PDF made the same choice.
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#6B1F2A");
      doc.text(`Rs. ${Number(price).toLocaleString("en-IN")}`, x + pad, cursor, {
        width: cellW - pad * 2,
      });
      cursor += 11;
    }

    // Barcode fills the remaining height, leaving room for the number beneath.
    const imgH = Math.max(y + cellH - cursor - 16, 18);
    doc.image(png, x + pad, cursor, { fit: [cellW - pad * 2, imgH], align: "center" });

    doc.fontSize(6.5).font("Helvetica").fillColor("#333333");
    doc.text(value, x + pad, y + cellH - 14, { width: cellW - pad * 2, align: "center" });

    if (code && code !== value) {
      doc.fontSize(5).fillColor("#777777");
      doc.text(code, x + pad, y + cellH - 7, { width: cellW - pad * 2, align: "center" });
    }
  }

  if (fellBack) {
    doc
      .fontSize(6)
      .fillColor("#B00020")
      .text(
        `Note: this number isn't a valid ${item.barcodeManagement?.symbology || "EAN-13"}, ` +
          `so it was printed as ${symbology}.`,
        SHEET.marginX,
        SHEET.height - 18,
        { width: SHEET.width - SHEET.marginX * 2 }
      );
  }

  doc.end();
});

module.exports = { barcodePng, labelsPdf, renderBarcode };
