/* eslint-disable no-console */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Item = require("../models/Item");
const { UPLOAD_ROOT } = require("../middleware/upload");

/**
 * One-off repair for media uploaded before the field-order fix.
 *
 * Symptom: the item's stored URL is /uploads/items/{branchId}/images/x.png but
 * the file is physically at /uploads/items/unassigned-branch/images/x.png,
 * because multer chose the folder before the branch field had been parsed. Every
 * such thumbnail 404s.
 *
 * This finds each media entry whose file is missing at its stored URL, locates
 * the file elsewhere under UPLOAD_ROOT by filename, moves it to where the URL
 * says it should be, and leaves the database untouched. If the file cannot be
 * found at all, the entry is reported so you can re-upload it.
 *
 * Usage:
 *   cd backend
 *   node src/utils/repairMediaUrls.js          # report only, changes nothing
 *   node src/utils/repairMediaUrls.js --apply  # actually move the files
 */

const APPLY = process.argv.includes("--apply");
const MEDIA_FIELDS = ["images", "videos", "gifs", "documents"];

/** Recursively index every file under UPLOAD_ROOT by basename. */
function indexFiles(dir, index = new Map()) {
  if (!fs.existsSync(dir)) return index;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) indexFiles(full, index);
    else if (!index.has(entry.name)) index.set(entry.name, full);
  }
  return index;
}

function absoluteFor(url) {
  const relative = String(url).replace(/^\/uploads\//, "");
  return path.join(UPLOAD_ROOT, relative);
}

async function main() {
  await connectDB();

  const index = indexFiles(UPLOAD_ROOT);
  console.log(`[repair] indexed ${index.size} file(s) under ${UPLOAD_ROOT}`);
  console.log(`[repair] mode: ${APPLY ? "APPLY (files will be moved)" : "DRY RUN (report only)"}\n`);

  const items = await Item.find({}, { images: 1, videos: 1, gifs: 1, documents: 1, identity: 1 });

  let okCount = 0;
  let movedCount = 0;
  const unresolved = [];

  for (const item of items) {
    const label = item.identity?.itemCode || item._id;

    for (const field of MEDIA_FIELDS) {
      for (const media of item[field] || []) {
        if (!media.url) continue;

        const expected = absoluteFor(media.url);
        if (fs.existsSync(expected)) {
          okCount += 1;
          continue;
        }

        const basename = path.basename(expected);
        const found = index.get(basename);

        if (!found) {
          unresolved.push({ item: label, field, url: media.url });
          continue;
        }

        console.log(`[repair] ${label} ${field}`);
        console.log(`         url  : ${media.url}`);
        console.log(`         found: ${path.relative(UPLOAD_ROOT, found)}`);

        if (APPLY) {
          fs.mkdirSync(path.dirname(expected), { recursive: true });
          fs.renameSync(found, expected);
          index.set(basename, expected);
          console.log(`         moved into place`);
        }
        movedCount += 1;
      }
    }
  }

  console.log(`\n[repair] already correct : ${okCount}`);
  console.log(`[repair] ${APPLY ? "moved" : "movable"}   : ${movedCount}`);
  console.log(`[repair] unresolvable    : ${unresolved.length}`);

  if (unresolved.length) {
    console.log("\n[repair] these need re-uploading through the admin UI:");
    unresolved.forEach((u) => console.log(`         ${u.item} ${u.field} -> ${u.url}`));
  }

  if (!APPLY && movedCount) {
    console.log("\n[repair] re-run with --apply to move the files listed above.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[repair] failed:", err.message);
  process.exit(1);
});
