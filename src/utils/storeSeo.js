const { slugify } = require("./seoNaming");

const BRAND = "Woven Essence";

/**
 * Storefront SEO helpers.
 *
 * Every public URL and every meta tag is generated from real product data — the
 * saree type, fabric, colour, occasion and branch city the admin actually
 * entered — rather than a fixed keyword list. A page for a Kanjivaram in
 * Bengaluru describes itself differently from a cotton saree in Chennai, which
 * is what makes the pages worth indexing separately.
 */

/** Keyword stems the brief asks to lead with. */
const LEAD_KEYWORDS = ["best sarees", "top sarees", "women sarees", "kids sarees", "sarees shop near me"];

/**
 * Canonical product slug: descriptive words first, item code last so the slug is
 * unique and permanently resolvable even if two sarees share a name.
 * e.g. best-kanjivaram-silk-saree-ruby-red-woven-essence-tf-0001-slk-kan-000001
 */
function productSlug(item) {
  const id = item.identity || {};
  const saree = item.saree || {};
  const colour = item.color || {};

  // The descriptive half is slugified (and length-capped) on its own, then the
  // item code is appended whole. Slugifying them together truncated the code
  // off the end, leaving a slug that could never be resolved back to a product.
  const descriptor = slugify(
    [
      saree.sareeType || id.category || "saree",
      saree.fabricType || saree.primaryFabric,
      colour.primaryColor,
      BRAND,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const code = slugify(id.itemCode);
  return [descriptor, code].filter(Boolean).join("-");
}

/** Branch slug used in catalog URLs: best-sarees-in-bengaluru-tf-0001 */
function branchSlug(branch) {
  const city = branch.address?.city;
  return slugify([city || branch.branchName, branch.branchCode].filter(Boolean).join(" "));
}

/** Resolve the item code back out of a product slug. */
function itemCodeFromSlug(slug) {
  const text = String(slug || "");

  // Item codes are {branchCode}-{groupCode}-{subgroupCode}-{6-digit sequence},
  // and branch codes are always TF-nnnn, so anchor on that to avoid a greedy
  // match swallowing the descriptive words in front of the code.
  const branchAnchored = text.match(/(?:^|-)(tf-\d{4}-[a-z0-9-]*?-\d{6})$/i);
  if (branchAnchored) return branchAnchored[1].toUpperCase();

  // Fallback for any other branch-code format: the last four hyphen-separated
  // segments plus the sequence.
  const tail = text.match(/((?:[a-z0-9]+-){4}\d{6})$/i);
  if (tail) return tail[1].toUpperCase();

  return null;
}

/**
 * Product page metadata. Title stays inside Google's ~60-char display window
 * where possible; description leads with the concrete attributes a shopper
 * searches for.
 */
function productMeta(item, branch) {
  const id = item.identity || {};
  const saree = item.saree || {};
  const colour = item.color || {};
  const pricing = item.pricing || {};
  const city = branch?.address?.city;

  const name = id.productName || "Saree";
  const descriptor = [colour.primaryColor, saree.sareeType || saree.fabricType].filter(Boolean).join(" ");

  const title = id.displayName
    ? `${id.displayName} | ${BRAND}`
    : `${name}${descriptor ? ` — ${descriptor}` : ""} | ${BRAND}`;

  const priceText = pricing.sellingPrice ? ` Buy online at ₹${pricing.sellingPrice}.` : "";
  const cityText = city ? ` Available at our ${city} store.` : "";

  const description =
    (id.shortDescription ||
      [
        "Shop",
        descriptor || "handpicked sarees",
        saree.handloomStatus === "handloom" ? "handloom woven" : null,
        saree.occasion ? `for ${saree.occasion}` : null,
        `from ${BRAND}`,
      ]
        .filter(Boolean)
        .join(" ") + ".") + priceText + cityText;

  const keywords = [
    name,
    saree.sareeType,
    saree.fabricType,
    saree.weaveType,
    colour.primaryColor && `${colour.primaryColor} saree`,
    saree.occasion && `${saree.occasion} saree`,
    city && `saree shop in ${city}`,
    city && `buy sarees online ${city}`,
    id.category,
    id.collectionName,
    BRAND,
    ...LEAD_KEYWORDS,
  ]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());

  return {
    title: title.slice(0, 120),
    description: description.slice(0, 320),
    keywords: [...new Set(keywords)],
    canonicalPath: `/saree/${item.seo?.slug || productSlug(item)}`,
  };
}

/** Catalog (branch listing) page metadata. */
function catalogMeta(branch, totalProducts) {
  const city = branch?.address?.city;
  const where = city || branch?.branchName || "India";

  return {
    title: `Best Sarees in ${where} — Silk, Cotton & Handloom | ${BRAND}`,
    description:
      `Browse ${totalProducts || ""} handpicked sarees at ${BRAND}${city ? ` ${city}` : ""}. ` +
      `Kanjivaram silk, handloom cotton, temple border and festive sarees for women and kids. ` +
      `Free video-call shopping available.`,
    keywords: [
      `best sarees in ${where}`,
      `saree shop in ${where}`,
      `silk sarees ${where}`,
      `handloom sarees ${where}`,
      "top sarees",
      "women sarees",
      "kids sarees",
      "sarees shop near me",
      "buy sarees online",
      BRAND.toLowerCase(),
    ],
    canonicalPath: `/best-sarees/${branch ? branchSlug(branch) : ""}`,
  };
}

/**
 * schema.org Product JSON-LD. Emitted server-side so it is identical for
 * crawlers and for the client, and only includes offers when a real price
 * exists — an offer with a null price is worse than no offer at all.
 */
function productJsonLd(item, branch, absoluteUrl, imageUrls = []) {
  const id = item.identity || {};
  const saree = item.saree || {};
  const colour = item.color || {};
  const pricing = item.pricing || {};
  const inventory = item.inventory || {};
  const reviews = item.reviews || {};

  const node = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: id.productName,
    description: id.shortDescription || id.description || undefined,
    sku: id.sku || id.itemCode,
    gtin13: /^\d{13}$/.test(String(id.barcode || "")) ? id.barcode : undefined,
    mpn: id.itemCode,
    brand: { "@type": "Brand", name: id.brand || BRAND },
    category: [id.category, saree.sareeType].filter(Boolean).join(" > ") || undefined,
    color: colour.primaryColor || undefined,
    material: saree.fabricType || saree.primaryFabric || undefined,
    image: imageUrls.length ? imageUrls : undefined,
    url: absoluteUrl,
  };

  if (pricing.sellingPrice) {
    node.offers = {
      "@type": "Offer",
      url: absoluteUrl,
      priceCurrency: pricing.currency || "INR",
      price: pricing.sellingPrice,
      availability:
        (inventory.currentStock || 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: BRAND },
    };
  }

  if (reviews.totalReviews > 0 && reviews.averageRating > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: reviews.averageRating,
      reviewCount: reviews.totalReviews,
    };
  }

  Object.keys(node).forEach((k) => node[k] === undefined && delete node[k]);
  return node;
}

module.exports = {
  BRAND,
  LEAD_KEYWORDS,
  productSlug,
  branchSlug,
  itemCodeFromSlug,
  productMeta,
  catalogMeta,
  productJsonLd,
};
