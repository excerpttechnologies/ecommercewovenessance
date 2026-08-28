const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Item is level 3 of the product structure (Section 5.3): Group -> Subgroup -> Item.
 *
 * This implements the COMPLETE Product Master field spec (Sections 1-35 of the
 * brief). Every field is optional except identity.productName, per the spec's
 * "all fields optional" rule, so partial data entry is always valid.
 *
 * Convention notes:
 *  - Object sub-schemas use { _id: false } (never referenced independently).
 *  - Repeatable sub-schemas (media, warehouse allocations, variants, FAQs) use
 *    { _id: true } so the UI can address and remove individual rows.
 *  - Every enum includes "" so a cleared <select> round-trips without a
 *    validation error.
 *  - Keyword/ID list fields are [String] so the UI can offer comma-entry.
 */

const sub = (definition) => new Schema(definition, { _id: false });
const row = (definition) => new Schema(definition, { _id: true });

const cap = (n, label) => [
  (arr) => !arr || arr.length <= n,
  `A maximum of ${n} ${label} is allowed per item`,
];

/* ── 1. Product Master / ERP Identity ─────────────────────────────────────── */
const identitySchema = sub({
  productCode: { type: String, trim: true },
  itemCode: { type: String, trim: true, uppercase: true }, // auto-generated, locked
  sku: { type: String, trim: true },
  erpItemCode: { type: String, trim: true },
  barcode: { type: String, trim: true }, // auto-generated, locked
  ean: { type: String, trim: true },
  upc: { type: String, trim: true },
  gtin: { type: String, trim: true },
  hsnCode: { type: String, trim: true },

  productName: { type: String, required: [true, "Product name is required"], trim: true, maxlength: 200 },
  displayName: { type: String, trim: true },
  shortName: { type: String, trim: true },
  description: { type: String, trim: true },
  shortDescription: { type: String, trim: true, maxlength: 500 },

  productType: { type: String, trim: true, default: "Saree" },
  nature: { type: String, trim: true },
  category: { type: String, trim: true },
  subcategory: { type: String, trim: true },
  brand: { type: String, trim: true },
  collectionName: { type: String, trim: true }, // "Collection" — renamed, `collection` is reserved by Mongoose
  season: { type: String, trim: true },
  gender: { type: String, trim: true, default: "Women" },
  ageGroup: { type: String, trim: true },
  department: { type: String, trim: true },
  division: { type: String, trim: true },

  featured: { type: Boolean, default: false },
  newArrival: { type: Boolean, default: false },
  bestSeller: { type: Boolean, default: false },
  trending: { type: Boolean, default: false },
  discontinued: { type: Boolean, default: false },
  discontinuedDate: { type: Date, default: null },
  launchDate: { type: Date, default: null },
});

/* ── 2. Saree-Specific ────────────────────────────────────────────────────── */
const sareeSchema = sub({
  sareeType: String,
  style: String,
  category: String,
  fabricType: String,
  fabricComposition: String,
  primaryFabric: String,
  secondaryFabric: String,
  weaveType: String,
  weaveMethod: String,
  handloomStatus: { type: String, enum: ["handloom", "powerloom", "unspecified", ""], default: "unspecified" },
  handcraftedStatus: { type: Boolean, default: false },
  craftType: String,
  craftCluster: String,
  artisanName: String,
  artisanCode: String,
  designType: String,
  patternType: String,
  motifType: String,
  printType: String,
  embroideryType: String,
  embroideryWork: String,
  zariType: String,
  zariQuality: String,
  zariWork: String,
  borderType: String,
  borderDesign: String,
  borderWidth: String,
  palluType: String,
  palluDesign: String,
  blouseIncluded: { type: Boolean, default: false },
  blouseType: String,
  blouseFabric: String,
  blouseDesign: String,
  blouseColor: String,
  blouseLength: String,
  sareeLength: String,
  sareeWidth: String,
  sareeWeight: String,
  fallIncluded: { type: Boolean, default: false },
  fallType: String,
  petticoatIncluded: { type: Boolean, default: false },
  occasion: String,
  usageType: String,
  seasonType: String,
  styleCategory: String,
});

/* ── 3. Colour ────────────────────────────────────────────────────────────── */
const colorSchema = sub({
  primaryColor: String,
  secondaryColor: String,
  tertiaryColor: String,
  borderColor: String,
  palluColor: String,
  blouseColor: String,
  colorFamily: String,
  colorCode: String,
  hexCode: {
    type: String,
    validate: {
      validator: (v) => !v || /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v),
      message: "hexCode must be a valid hex colour, e.g. #6B1F2A",
    },
  },
  pantoneCode: String,
  multiColorStatus: { type: Boolean, default: false },
});

/* ── 4. Size & Measurement ────────────────────────────────────────────────── */
const sizeSchema = sub({
  sizeType: String,
  standardSize: String,
  sareeLength: Number,
  sareeLengthUnit: { type: String, default: "m" },
  sareeWidth: Number,
  sareeWidthUnit: { type: String, default: "in" },
  blouseLength: Number,
  blouseLengthUnit: { type: String, default: "m" },
  borderWidth: Number,
  borderWidthUnit: { type: String, default: "in" },
  palluLength: Number,
  palluLengthUnit: { type: String, default: "m" },
  productWeight: Number,
  productWeightUnit: { type: String, default: "g" },
  packageWeight: Number,
  packageWeightUnit: { type: String, default: "g" },
});

/* ── 5. Pricing ───────────────────────────────────────────────────────────── */
const pricingSchema = sub({
  costPrice: Number,
  purchasePrice: Number,
  mrp: Number,
  sellingPrice: Number,
  minSellingPrice: Number,
  maxRetailPrice: Number,
  discountType: { type: String, enum: ["flat", "percentage", ""], default: "" },
  discountValue: Number,
  discountPercent: Number,
  memberPrice: Number,
  vipPrice: Number,
  wholesalePrice: Number,
  bulkPrice: Number,
  dealerPrice: Number,
  employeePrice: Number,
  onlinePrice: Number,
  offlineRetailPrice: Number,
  marketplacePrice: Number,
  minBulkQty: Number,
  priceEffectiveFrom: Date,
  priceEffectiveTo: Date,
  currency: { type: String, default: "INR" },
  taxInclusive: { type: Boolean, default: true },
});

/* ── 6. GST / Tax / Accounting ────────────────────────────────────────────── */
const taxSchema = sub({
  gstApplicable: { type: Boolean, default: true },
  gstRate: Number,
  cgstRate: Number,
  sgstRate: Number,
  igstRate: Number,
  cessRate: Number,
  hsnCode: String,
  sacCode: String,
  taxCategory: String,
  taxClass: String,
  taxInclusivePrice: Number,
  taxExclusivePrice: Number,
  purchaseTaxRate: Number,
  salesTaxRate: Number,
  inputTaxApplicable: { type: Boolean, default: true },
  outputTaxApplicable: { type: Boolean, default: true },
  tdsApplicable: { type: Boolean, default: false },
  tcsApplicable: { type: Boolean, default: false },
  accountingCategory: String,
  salesAccount: String,
  purchaseAccount: String,
  inventoryAccount: String,
  discountAccount: String,
});

/* ── 7. Inventory / Retail ERP ────────────────────────────────────────────── */
const inventorySchema = sub({
  erpProductId: String,
  erpItemId: String,
  inventoryItemId: String,
  barcodeType: String,
  barcodeFormat: String,
  alternateBarcode: String,
  stockKeepingUnit: String,
  batchNo: String,
  serialNo: String,
  openingStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 },
  damagedStock: { type: Number, default: 0 },
  defectiveStock: { type: Number, default: 0 },
  inTransitStock: { type: Number, default: 0 },
  incomingStock: { type: Number, default: 0 },
  minStockLevel: Number,
  maxStockLevel: Number,
  reorderLevel: Number,
  reorderQty: Number,
  safetyStock: Number,
  stockStatus: {
    type: String,
    enum: ["in_stock", "low_stock", "out_of_stock", "discontinued", ""],
    default: "in_stock",
  },
  inventoryStatus: String,
  stockAlertLevel: Number,
  unitOfMeasure: { type: String, default: "pcs" },
  baseUnit: String,
  purchaseUnit: String,
  salesUnit: String,
  conversionFactor: { type: Number, default: 1 },
  inventoryValuationMethod: { type: String, enum: ["FIFO", "LIFO", "Weighted Average", ""], default: "" },
});

/* ── 8. Barcode Management ────────────────────────────────────────────────── */
const barcodeManagementSchema = sub({
  barcodeId: String,
  barcodeNumber: String,
  barcodeType: String,
  symbology: {
    type: String,
    enum: ["EAN-13", "EAN-8", "UPC-A", "UPC-E", "Code-128", "Code-39", "ITF-14", "GS1", "QR Code", ""],
    default: "EAN-13",
  },
  internalBarcode: String, // mirrors identity.barcode, locked
  supplierBarcode: String,
  manufacturerBarcode: String,
  barcodeImageUrl: String,
  printTemplate: String,
  printQty: { type: Number, default: 1 },
  barcodeStatus: { type: String, enum: ["active", "inactive", ""], default: "active" },
  generatedDate: { type: Date, default: Date.now },
  generatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
});

/* ── 9. Supplier / Purchase ───────────────────────────────────────────────── */
const supplierSchema = sub({
  supplierId: String,
  supplierName: String,
  supplierCode: String,
  supplierSku: String,
  supplierItemCode: String,
  supplierBarcode: String,
  manufacturer: String,
  manufacturerCode: String,
  manufacturerName: String,
  manufacturerAddress: String,
  manufacturerContact: String,
  countryOfOrigin: { type: String, default: "India" },
  importerName: String,
  importerAddress: String,
  packerName: String,
  packerAddress: String,
  purchasePrice: Number,
  supplierPrice: Number,
  minOrderQty: Number,
  purchaseLeadTime: Number,
  purchaseUnit: String,
  supplierTaxDetails: String,
  supplierWarranty: String,
  supplierNotes: String,
});

/* ── 10. Warehouse / Store Mapping (repeatable) ───────────────────────────── */
const warehouseAllocationSchema = row({
  warehouseId: String,
  warehouseName: String,
  storeId: String,
  store: String,
  locationName: String,
  counter: String,
  rack: String,
  shelf: String,
  bin: String,
  aisle: String,
  zone: String,
  openingStock: { type: Number, default: 0 },
  currentStock: { type: Number, default: 0 },
  minStock: Number,
  maxStock: Number,
  reorderLevel: Number,
  reorderQty: Number,
  storeSellingPrice: Number,
  storeMRP: Number,
  storeStatus: { type: String, enum: ["active", "inactive", ""], default: "active" },
});

/* ── 11-12. Images (max 10) ───────────────────────────────────────────────── */
const IMAGE_CATEGORIES = [
  "Main Product Image", "Front View", "Back View", "Side View", "Pallu View",
  "Border Closeup", "Fabric Closeup", "Blouse Image", "Model Image",
  "Lifestyle Image", "Packaging Image", "Label Image", "Certification Image",
  "Size Chart Image",
];

const imageSchema = row({
  url: { type: String, required: true },
  filename: String,
  category: { type: String, enum: [...IMAGE_CATEGORIES, ""], default: "" },
  altText: String,
  sortOrder: { type: Number, default: 0 },
});

/* ── 13. Videos (max 10) ──────────────────────────────────────────────────── */
const videoSchema = row({
  url: { type: String, required: true },
  filename: String,
  type: String,
  duration: Number,
  thumbnail: String,
  title: String,
  description: String,
  altText: String,
  sortOrder: { type: Number, default: 0 },
  category: String,
});

/* ── 14. GIF / Animation (max 10) ─────────────────────────────────────────── */
const gifSchema = row({
  url: { type: String, required: true },
  filename: String,
  altText: String,
  sortOrder: { type: Number, default: 0 },
});

/* ── 15. Other Product Files (max 10) ─────────────────────────────────────── */
const DOCUMENT_TYPES = [
  "PDF", "Certificate", "Authenticity Certificate", "Quality Certificate",
  "Silk Mark Certificate", "GI Certificate", "Product Manual", "Care Guide",
  "Size Guide", "Warranty Document", "Specification Sheet",
];

const documentSchema = row({
  url: { type: String, required: true },
  filename: String,
  docType: { type: String, enum: [...DOCUMENT_TYPES, ""], default: "" },
  title: String,
});

/* ── 16. AI Image Analysis ────────────────────────────────────────────────── */
const aiImageAnalysisSchema = sub({
  enabled: { type: Boolean, default: false },
  detectedProductType: String,
  detectedSareeType: String,
  detectedFabric: String,
  detectedPrimaryColor: String,
  detectedSecondaryColor: String,
  detectedPattern: String,
  detectedDesign: String,
  detectedBorder: String,
  detectedPallu: String,
  detectedBlouse: String,
  detectedOccasion: String,
  detectedStyle: String,
  detectedWork: String,
  detectedWeave: String,
  detectedQuality: String,
  confidenceScore: Number,
  analysisStatus: { type: String, enum: ["pending", "processing", "complete", "failed", ""], default: "" },
  analysisDate: Date,
});

/* ── 17. AI Product Content ───────────────────────────────────────────────── */
const aiContentSchema = sub({
  enabled: { type: Boolean, default: false },
  generatedProductName: String,
  generatedShortDescription: String,
  generatedLongDescription: String,
  generatedHighlights: [String],
  generatedFeatures: [String],
  generatedBenefits: [String],
  generatedStylingSuggestions: String,
  generatedOccasionSuggestions: String,
  generatedCareInstructions: String,
  generatedBuyingGuide: String,
  generatedFaq: String,
  qualityScore: Number,
  approvalStatus: { type: String, enum: ["pending", "approved", "rejected", ""], default: "" },
  generatedDate: Date,
});

/* ── 18. AI SEO ───────────────────────────────────────────────────────────── */
const seoSchema = sub({
  enabled: { type: Boolean, default: false },
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  focusKeyword: String,
  secondaryKeywords: [String],
  longTailKeywords: [String],
  relatedKeywords: [String],
  semanticKeywords: [String],
  searchIntent: {
    type: String,
    enum: ["informational", "navigational", "commercial", "transactional", ""],
    default: "",
  },
  slug: String,
  canonicalUrl: String,
  robotsIndex: { type: Boolean, default: true },
  robotsFollow: { type: Boolean, default: true },
  aiSeoScore: Number,
  contentScore: Number,
  keywordOptimizationScore: Number,
  metaTitleScore: Number,
  metaDescriptionScore: Number,
  recommendations: [String],
  issues: [String],
  lastUpdated: Date,
});

/* ── 23. Product Care ─────────────────────────────────────────────────────── */
const careSchema = sub({
  careInstructions: String,
  washCare: String,
  dryCleanRequired: { type: Boolean, default: false },
  ironingInstructions: String,
  bleachingAllowed: { type: Boolean, default: false },
  machineWashAllowed: { type: Boolean, default: false },
  handWashAllowed: { type: Boolean, default: true },
  dryingInstructions: String,
  storageInstructions: String,
  foldingInstructions: String,
  specialCareInstructions: String,
});

/* ── 24. Styling / Fashion Information ────────────────────────────────────── */
const stylingSchema = sub({
  stylingSuggestions: String,
  blouseStylingSuggestions: String,
  jewellerySuggestions: String,
  footwearSuggestions: String,
  makeupSuggestions: String,
  hairstyleSuggestions: String,
  drapingStyle: String,
  recommendedAccessories: String,
  recommendedOccasion: String,
  recommendedSeason: String,
  fashionStyle: String,
  aiStylingScore: Number,
});

/* ── 26. Shipping ─────────────────────────────────────────────────────────── */
const shippingSchema = sub({
  enabled: { type: Boolean, default: true },
  weight: Number,
  weightUnit: { type: String, default: "g" },
  packageLength: Number,
  packageWidth: Number,
  packageHeight: Number,
  dimensionUnit: { type: String, default: "cm" },
  shippingClass: String,
  shippingCategory: String,
  freeShipping: { type: Boolean, default: false },
  freeShippingThreshold: Number,
  shippingCharge: Number,
  codAvailable: { type: Boolean, default: true },
  codCharge: Number,
  estimatedDeliveryTime: String,
  sameDayDelivery: { type: Boolean, default: false },
  expressDelivery: { type: Boolean, default: false },
  internationalShipping: { type: Boolean, default: false },
  shippingRestrictions: String,
});

/* ── 27. Return / Exchange ────────────────────────────────────────────────── */
const returnsSchema = sub({
  returnApplicable: { type: Boolean, default: true },
  returnWindow: Number,
  exchangeApplicable: { type: Boolean, default: true },
  exchangeWindow: Number,
  returnReasonRequired: { type: Boolean, default: true },
  returnCondition: String,
  refundMethod: String,
  refundProcessingTime: String,
  cancellationAllowed: { type: Boolean, default: true },
  cancellationWindow: Number,
  returnShippingResponsibility: { type: String, enum: ["customer", "seller", ""], default: "" },
});

/* ── 28. Marketplace Integration ──────────────────────────────────────────── */
const marketplaceSchema = sub({
  enabled: { type: Boolean, default: false },
  amazonSku: String,
  flipkartSku: String,
  myntraSku: String,
  meeshoSku: String,
  shopifySku: String,
  wooCommerceSku: String,
  marketplaceProductId: String,
  marketplaceCategoryId: String,
  marketplaceListingId: String,
  status: String,
  price: Number,
  stock: Number,
  syncStatus: { type: String, enum: ["pending", "synced", "failed", ""], default: "" },
  syncDate: Date,
});

/* ── 29. Ecommerce Visibility ─────────────────────────────────────────────── */
const visibilitySchema = sub({
  onlineSaleEnabled: { type: Boolean, default: true },
  offlineSaleEnabled: { type: Boolean, default: true },
  posSaleEnabled: { type: Boolean, default: true },
  marketplaceSaleEnabled: { type: Boolean, default: false },
  b2bSaleEnabled: { type: Boolean, default: false },
  wholesaleSaleEnabled: { type: Boolean, default: false },
  memberSaleEnabled: { type: Boolean, default: false },
  flashSaleEligible: { type: Boolean, default: false },
  discountEligible: { type: Boolean, default: true },
  couponEligible: { type: Boolean, default: true },
  giftEligible: { type: Boolean, default: true },
});

/* ── 30. Product Relationships ────────────────────────────────────────────── */
const relationshipsSchema = sub({
  parentProductId: String,
  parentSku: String,
  variantId: String,
  variantSku: String,
  relatedProductIds: [String],
  similarProductIds: [String],
  crossSellProductIds: [String],
  upSellProductIds: [String],
  frequentlyBoughtTogetherIds: [String],
  recommendedProductIds: [String],
  alternativeProductIds: [String],
  complementaryProductIds: [String],
});

/* ── 31. Variants ─────────────────────────────────────────────────────────── */
const variantSettingsSchema = sub({
  enabled: { type: Boolean, default: false },
  variantType: String,
});

const variantSchema = row({
  name: String,
  sku: String,
  itemCode: String,
  barcode: String,
  color: String,
  size: String,
  fabric: String,
  design: String,
  price: Number,
  mrp: Number,
  costPrice: Number,
  stock: Number,
  weight: Number,
  imageUrl: String,
  status: { type: String, enum: ["active", "inactive", ""], default: "active" },
});

/* ── 32. Customer / Sales Intelligence (system-maintained) ────────────────── */
const salesIntelligenceSchema = sub({
  totalViews: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalQuantitySold: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  averageSellingPrice: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  wishlistCount: { type: Number, default: 0 },
  cartCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 },
  returnCount: { type: Number, default: 0 },
  cancellationCount: { type: Number, default: 0 },
  bestSellingRank: Number,
  popularityScore: { type: Number, default: 0 },
});

/* ── 33. AI Recommendation Engine ─────────────────────────────────────────── */
const aiRecommendationSchema = sub({
  enabled: { type: Boolean, default: false },
  similarityScore: Number,
  productMatchScore: Number,
  customerPreferenceScore: Number,
  recommendationCategory: String,
  crossSellRecommendation: String,
  upSellRecommendation: String,
  relatedProductRecommendation: String,
  frequentlyBoughtTogetherRecommendation: String,
  trendingScore: Number,
});

/* ── 34. Reviews ──────────────────────────────────────────────────────────── */
const reviewsSchema = sub({
  reviewsEnabled: { type: Boolean, default: true },
  ratingEnabled: { type: Boolean, default: true },
  averageRating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  verifiedPurchaseReviews: { type: Number, default: 0 },
  reviewStatus: { type: String, enum: ["open", "closed", ""], default: "open" },
  moderationEnabled: { type: Boolean, default: true },
  customerQuestionsEnabled: { type: Boolean, default: true },
  customerAnswersEnabled: { type: Boolean, default: true },
  customerImageReviewsEnabled: { type: Boolean, default: false },
  customerVideoReviewsEnabled: { type: Boolean, default: false },
});

/* ── 35. Product FAQ (repeatable) ─────────────────────────────────────────── */
const faqSchema = row({
  question: String,
  answer: String,
});

/* ── Root document ────────────────────────────────────────────────────────── */
const itemSchema = new Schema(
  {
    branch: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    subgroup: { type: Schema.Types.ObjectId, ref: "Subgroup", required: true, index: true },

    identity: { type: identitySchema, default: () => ({}) },
    saree: { type: sareeSchema, default: () => ({}) },
    color: { type: colorSchema, default: () => ({}) },
    size: { type: sizeSchema, default: () => ({}) },
    pricing: { type: pricingSchema, default: () => ({}) },
    tax: { type: taxSchema, default: () => ({}) },
    inventory: { type: inventorySchema, default: () => ({}) },
    barcodeManagement: { type: barcodeManagementSchema, default: () => ({}) },
    supplier: { type: supplierSchema, default: () => ({}) },

    warehouseAllocations: { type: [warehouseAllocationSchema], default: [] },

    images: { type: [imageSchema], validate: cap(10, "images"), default: [] },
    videos: { type: [videoSchema], validate: cap(10, "videos"), default: [] },
    gifs: { type: [gifSchema], validate: cap(10, "GIFs"), default: [] },
    documents: { type: [documentSchema], validate: cap(10, "documents"), default: [] },

    aiImageAnalysis: { type: aiImageAnalysisSchema, default: () => ({}) },
    aiContent: { type: aiContentSchema, default: () => ({}) },
    seo: { type: seoSchema, default: () => ({}) },
    care: { type: careSchema, default: () => ({}) },
    styling: { type: stylingSchema, default: () => ({}) },
    shipping: { type: shippingSchema, default: () => ({}) },
    returns: { type: returnsSchema, default: () => ({}) },
    marketplace: { type: marketplaceSchema, default: () => ({}) },
    visibility: { type: visibilitySchema, default: () => ({}) },
    relationships: { type: relationshipsSchema, default: () => ({}) },
    variantSettings: { type: variantSettingsSchema, default: () => ({}) },
    variants: { type: [variantSchema], default: [] },
    salesIntelligence: { type: salesIntelligenceSchema, default: () => ({}) },
    aiRecommendation: { type: aiRecommendationSchema, default: () => ({}) },
    reviews: { type: reviewsSchema, default: () => ({}) },
    faqs: { type: [faqSchema], default: [] },

    status: { type: String, enum: ["active", "inactive"], default: "active", index: true },
    lifecycleStage: {
      type: String,
      enum: ["draft", "published", "unpublished", "hold"],
      default: "draft",
      index: true,
    },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

// Partial filter so a soft-deleted item releases its code/barcode for reuse.
itemSchema.index(
  { "identity.itemCode": 1 },
  { unique: true, partialFilterExpression: { "identity.itemCode": { $type: "string" }, isDeleted: { $ne: true } } }
);
itemSchema.index(
  { "identity.barcode": 1 },
  { unique: true, partialFilterExpression: { "identity.barcode": { $type: "string" }, isDeleted: { $ne: true } } }
);
itemSchema.index({
  "identity.productName": "text",
  "identity.itemCode": "text",
  "identity.sku": "text",
  "identity.barcode": "text",
});

/**
 * Auto system-generated Item Code (Section 5.3): branch + group + subgroup code
 * plus a running sequence, e.g. TF-0001-SLK-KAN-000001.
 */
itemSchema.statics.generateItemCode = async function (branchCode, groupCode, subgroupCode) {
  const escape = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = `${branchCode}-${groupCode}-${subgroupCode}`;
  const last = await this.findOne(
    { "identity.itemCode": new RegExp(`^${escape(prefix)}-`) },
    { "identity.itemCode": 1 }
  ).sort({ createdAt: -1 });

  let nextSeq = 1;
  if (last?.identity?.itemCode) {
    const match = last.identity.itemCode.match(/(\d+)$/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  let code;
  let exists = true;
  while (exists) {
    code = `${prefix}-${String(nextSeq).padStart(6, "0")}`;
    exists = await this.exists({ "identity.itemCode": code });
    if (exists) nextSeq += 1;
  }
  return code;
};

/**
 * Auto-generates a unique EAN-13-structured internal barcode (Section 5.4.8).
 * NOTE: prefix 200 is the GS1 "restricted circulation within a company" range,
 * so these never collide with GTINs registered to other companies. Switch to a
 * licensed GS1 company prefix before publishing to marketplaces.
 */
itemSchema.statics.generateBarcode = async function () {
  const ean13CheckDigit = (digits12) => {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(digits12[i], 10) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10;
  };

  let barcode;
  let exists = true;
  while (exists) {
    const body = "200" + String(Math.floor(100000000 + Math.random() * 900000000)).slice(0, 9);
    barcode = body + ean13CheckDigit(body);
    exists = await this.exists({ "identity.barcode": barcode });
  }
  return barcode;
};

module.exports = mongoose.model("Item", itemSchema);
module.exports.IMAGE_CATEGORIES = IMAGE_CATEGORIES;
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES;
