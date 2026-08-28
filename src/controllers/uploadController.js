const fs = require("fs");
const asyncHandler = require("express-async-handler");
const { generateSeoAltText } = require("../utils/seoNaming");
const { toPublicUrl } = require("../middleware/upload");

/**
 * Returns the metadata the frontend attaches to an item's media array. The file
 * is already on local disk by the time this runs (Section 1/8: local /uploads
 * only — no Base64, no Cloudinary).
 *
 * The URL is derived from req.file.path — the path multer actually wrote — so it
 * can never drift from the file's real location. Deriving it from req.body
 * instead was how every stored image URL ended up pointing at a folder the file
 * was not in.
 */
function makeUploadHandler(kind) {
  return asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded (the form field must be named 'file')");
    }

    const url = toPublicUrl(req.file.path);

    // Fail loudly rather than handing back a URL to a file that isn't there.
    if (!fs.existsSync(req.file.path)) {
      res.status(500);
      throw new Error("Upload did not persist to disk — check UPLOAD_ROOT permissions");
    }

    res.status(201).json({
      success: true,
      data: {
        url,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        category: req.body?.category || "",
        altText: generateSeoAltText({
          category: req.body?.category,
          productName: req.body?.productName,
        }),
        branch: req.uploadTarget?.branchSegment || "unassigned-branch",
        uploadedAt: new Date().toISOString(),
      },
    });
  });
}

module.exports = {
  uploadImage: makeUploadHandler("image"),
  uploadVideo: makeUploadHandler("video"),
  uploadGif: makeUploadHandler("gif"),
  uploadDocument: makeUploadHandler("document"),
};
