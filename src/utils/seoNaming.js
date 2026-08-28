const path = require("path");

const BRAND_SLUG = "wovenessence";

/**
 * Auto SEO filename/keyword generation on upload (Section 7): combines the brand
 * slug with descriptive keywords derived from context (category, product name if
 * known, original filename) into a URL/SEO-friendly stored filename, e.g.
 * "bestsaree-wovenessence-image1.png". This is a real utility invoked by the
 * upload pipeline, not a static example.
 */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function generateSeoFilename({ originalName, category, productName, index }) {
  const ext = path.extname(originalName || "").toLowerCase() || "";
  const baseName = path.basename(originalName || "file", ext);

  const keywordParts = [];
  if (productName) keywordParts.push(slugify(productName));
  if (category) keywordParts.push(slugify(category));
  keywordParts.push(BRAND_SLUG);
  keywordParts.push(slugify(baseName) || "media");
  if (index !== undefined && index !== null) keywordParts.push(String(index));

  const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const seoSlug = keywordParts.filter(Boolean).join("-");

  return `${seoSlug}-${uniqueSuffix}${ext}`;
}

/**
 * Generates SEO alt text from the same inputs, for the alt-text field admins can
 * then refine (Section 5.4.11-13 image fields all carry alt/label text).
 */
function generateSeoAltText({ category, productName }) {
  const parts = [productName, category, "Woven Essence Sarees"].filter(Boolean);
  return parts.join(" - ");
}

module.exports = { generateSeoFilename, generateSeoAltText, slugify };
