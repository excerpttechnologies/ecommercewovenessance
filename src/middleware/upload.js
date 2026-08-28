const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { generateSeoFilename } = require("../utils/seoNaming");

/**
 * Local-disk storage root. No cloud storage, no Base64 — only the resulting URL
 * path is ever written to MongoDB (Section 1/8 of the brief).
 */
const UPLOAD_ROOT = path.resolve(
  __dirname,
  "..",
  (process.env.UPLOAD_ROOT || "uploads").replace(/^src[\\/]/, "")
);

const MIME_BY_KIND = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  gif: ["image/gif"],
  document: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The branch id becomes a folder name, so it is never trusted verbatim: a value
 * like "../../.." would otherwise write outside UPLOAD_ROOT. Only a real
 * 24-character ObjectId is accepted; anything else is filed under
 * "unassigned-branch".
 */
function safeBranchSegment(req) {
  const raw = req.query.branch || req.body?.branch || "";
  return OBJECT_ID.test(String(raw)) ? String(raw) : "unassigned-branch";
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Builds a single-file uploader for one media kind, storing to
 * uploads/items/{branchId}/{kind}s/{seo-filename} so the "organised by
 * module/branch" requirement is enforced by the path itself.
 *
 * The chosen directory and filename are recorded on the request
 * (req.uploadTarget) so the controller can build the public URL from what was
 * ACTUALLY written to disk, rather than re-deriving it from the body and
 * risking a mismatch.
 */
function buildUploader(kind) {
  const storage = multer.diskStorage({
    destination(req, file, cb) {
      const branchSegment = safeBranchSegment(req);
      const relativeDir = path.posix.join("items", branchSegment, `${kind}s`);
      const absoluteDir = path.join(UPLOAD_ROOT, "items", branchSegment, `${kind}s`);

      try {
        ensureDir(absoluteDir);
      } catch (err) {
        return cb(err);
      }

      req.uploadTarget = { relativeDir, absoluteDir, branchSegment };
      cb(null, absoluteDir);
    },
    filename(req, file, cb) {
      const seoName = generateSeoFilename({
        originalName: file.originalname,
        category: req.body?.category || req.query.category || "",
        productName: req.body?.productName || req.query.productName || "",
      });
      if (req.uploadTarget) req.uploadTarget.filename = seoName;
      cb(null, seoName);
    },
  });

  const maxMb = parseInt(process.env.MAX_UPLOAD_MB, 10) || 25;

  return multer({
    storage,
    limits: { fileSize: maxMb * 1024 * 1024 },
    fileFilter(req, file, cb) {
      const allowed = MIME_BY_KIND[kind] || [];
      if (!allowed.includes(file.mimetype)) {
        const err = new Error(
          `Unsupported file type for ${kind}: ${file.mimetype}. Allowed: ${allowed.join(", ")}`
        );
        err.statusCode = 400;
        return cb(err);
      }
      cb(null, true);
    },
  });
}

/**
 * Turns an absolute on-disk path into the public URL the static middleware
 * serves it at. Single source of truth for the URL, so the stored value can
 * never disagree with the file's real location.
 */
function toPublicUrl(absolutePath) {
  const relative = path.relative(UPLOAD_ROOT, absolutePath).split(path.sep).join("/");
  return `/uploads/${relative}`;
}

module.exports = { buildUploader, UPLOAD_ROOT, toPublicUrl, safeBranchSegment };
