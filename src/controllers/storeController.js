// // // const asyncHandler = require("express-async-handler");
// // // const Branch = require("../models/Branch");
// // // const Group = require("../models/Group");
// // // const Subgroup = require("../models/Subgroup");
// // // const Item = require("../models/Item");
// // // const {
// // //   productSlug,
// // //   branchSlug,
// // //   itemCodeFromSlug,
// // //   productMeta,
// // //   catalogMeta,
// // //   productJsonLd,
// // // } = require("../utils/storeSeo");

// // // /**
// // //  * Public storefront API — no authentication, read-only.
// // //  *
// // //  * Visibility rule, applied to every query in this file: a saree reaches the
// // //  * storefront only if it is active, published, not deleted, and its
// // //  * visibility.onlineSaleEnabled is not false. The admin's draft/hold workflow is
// // //  * therefore a real gate, not decoration.
// // //  */

// // // const LIVE_ITEM = {
// // //   isDeleted: { $ne: true },
// // //   status: "active",
// // //   lifecycleStage: "published",
// // //   "visibility.onlineSaleEnabled": { $ne: false },
// // // };

// // // const LIVE_BRANCH = {
// // //   isDeleted: { $ne: true },
// // //   status: "active",
// // // };

// // // /** Fields the catalog grid needs — deliberately narrow, these lists get long. */
// // // const CARD_FIELDS = {
// // //   "identity.productName": 1,
// // //   "identity.displayName": 1,
// // //   "identity.itemCode": 1,
// // //   "identity.brand": 1,
// // //   "identity.category": 1,
// // //   "identity.featured": 1,
// // //   "identity.newArrival": 1,
// // //   "identity.bestSeller": 1,
// // //   "identity.trending": 1,
// // //   "saree.sareeType": 1,
// // //   "saree.fabricType": 1,
// // //   "saree.primaryFabric": 1,
// // //   "saree.handloomStatus": 1,
// // //   "saree.occasion": 1,
// // //   "color.primaryColor": 1,
// // //   "pricing.mrp": 1,
// // //   "pricing.sellingPrice": 1,
// // //   "pricing.discountPercent": 1,
// // //   "pricing.currency": 1,
// // //   "inventory.currentStock": 1,
// // //   "reviews.averageRating": 1,
// // //   "reviews.totalReviews": 1,
// // //   "seo.slug": 1,
// // //   images: 1,
// // //   branch: 1,
// // //   group: 1,
// // //   subgroup: 1,
// // //   createdAt: 1,
// // // };

// // // function escapeRegex(text) {
// // //   return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// // // }

// // // /** Shapes a catalog card, including its SEO slug and a single hero image. */
// // // function toCard(item) {
// // //   const images = Array.isArray(item.images) ? item.images : [];
// // //   const hero =
// // //     images.find((i) => i.category === "Main Product Image") || images[0] || null;

// // //   const mrp = item.pricing?.mrp;
// // //   const selling = item.pricing?.sellingPrice;
// // //   const discountPercent =
// // //     mrp && selling && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null;

// // //   return {
// // //     id: item._id,
// // //     slug: item.seo?.slug || productSlug(item),
// // //     itemCode: item.identity?.itemCode || "",
// // //     name: item.identity?.displayName || item.identity?.productName || "Saree",
// // //     brand: item.identity?.brand || "Woven Essence",
// // //     sareeType: item.saree?.sareeType || "",
// // //     fabric: item.saree?.fabricType || item.saree?.primaryFabric || "",
// // //     handloom: item.saree?.handloomStatus === "handloom",
// // //     occasion: item.saree?.occasion || "",
// // //     colour: item.color?.primaryColor || "",
// // //     mrp: mrp ?? null,
// // //     sellingPrice: selling ?? null,
// // //     discountPercent,
// // //     currency: item.pricing?.currency || "INR",
// // //     inStock: (item.inventory?.currentStock || 0) > 0,
// // //     rating: item.reviews?.averageRating || 0,
// // //     reviewCount: item.reviews?.totalReviews || 0,
// // //     image: hero ? { url: hero.url, altText: hero.altText || item.identity?.productName } : null,
// // //     imageCount: images.length,
// // //     badges: [
// // //       item.identity?.bestSeller && "Best seller",
// // //       item.identity?.newArrival && "New arrival",
// // //       item.identity?.trending && "Trending",
// // //       item.identity?.featured && "Featured",
// // //     ].filter(Boolean),
// // //   };
// // // }

// // // // GET /api/woven-essence/store/branches
// // // // The landing page's branch chooser. Only branches a shopper can actually buy from.
// // // const listBranches = asyncHandler(async (req, res) => {
// // //   const branches = await Branch.find(LIVE_BRANCH)
// // //     .select("branchName branchCode address location contact")
// // //     .sort("branchName")
// // //     .lean();

// // //   const withCounts = await Promise.all(
// // //     branches.map(async (branch) => {
// // //       const productCount = await Item.countDocuments({ ...LIVE_ITEM, branch: branch._id });
// // //       return {
// // //         id: branch._id,
// // //         name: branch.branchName,
// // //         code: branch.branchCode,
// // //         slug: branchSlug(branch),
// // //         city: branch.address?.city || "",
// // //         state: branch.address?.state || "",
// // //         pincode: branch.address?.pincode || "",
// // //         phone: branch.contact?.phone || "",
// // //         location: branch.location || null,
// // //         productCount,
// // //       };
// // //     })
// // //   );

// // //   res.json({ success: true, data: withCounts });
// // // });

// // // /** Resolves a branch by id or SEO slug. */
// // // async function resolveBranch(idOrSlug) {
// // //   if (!idOrSlug) return null;
// // //   if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
// // //     return Branch.findOne({ _id: idOrSlug, ...LIVE_BRANCH }).lean();
// // //   }
// // //   const code = String(idOrSlug).match(/(tf-\d{4})$/i);
// // //   if (code) {
// // //     return Branch.findOne({ branchCode: code[1].toUpperCase(), ...LIVE_BRANCH }).lean();
// // //   }
// // //   return null;
// // // }

// // // // GET /api/woven-essence/store/catalog
// // // // Query: branch, q, group, subgroup, colour, fabric, sareeType, occasion,
// // // //        minPrice, maxPrice, sort, page, limit
// // // const catalog = asyncHandler(async (req, res) => {
// // //   const branch = await resolveBranch(req.query.branch);
// // //   if (req.query.branch && !branch) {
// // //     res.status(404);
// // //     throw new Error("Branch not found or not open for online orders");
// // //   }

// // //   const filter = { ...LIVE_ITEM };
// // //   if (branch) filter.branch = branch._id;

// // //   if (req.query.group) filter.group = req.query.group;
// // //   if (req.query.subgroup) filter.subgroup = req.query.subgroup;

// // //   // Attribute facets, matched case-insensitively so "Ruby Red" and "ruby red" agree.
// // //   const facetMap = {
// // //     colour: "color.primaryColor",
// // //     fabric: "saree.fabricType",
// // //     sareeType: "saree.sareeType",
// // //     occasion: "saree.occasion",
// // //   };
// // //   Object.entries(facetMap).forEach(([param, path]) => {
// // //     const value = req.query[param];
// // //     if (value) filter[path] = new RegExp(`^${escapeRegex(value)}$`, "i");
// // //   });

// // //   if (req.query.handloom === "true") filter["saree.handloomStatus"] = "handloom";
// // //   if (req.query.inStock === "true") filter["inventory.currentStock"] = { $gt: 0 };

// // //   const min = Number(req.query.minPrice);
// // //   const max = Number(req.query.maxPrice);
// // //   if (!Number.isNaN(min) || !Number.isNaN(max)) {
// // //     filter["pricing.sellingPrice"] = {};
// // //     if (!Number.isNaN(min)) filter["pricing.sellingPrice"].$gte = min;
// // //     if (!Number.isNaN(max)) filter["pricing.sellingPrice"].$lte = max;
// // //   }

// // //   // Search across the fields a shopper would actually type.
// // //   if (req.query.q) {
// // //     const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
// // //     filter.$or = [
// // //       { "identity.productName": rx },
// // //       { "identity.displayName": rx },
// // //       { "identity.shortDescription": rx },
// // //       { "identity.category": rx },
// // //       { "identity.collectionName": rx },
// // //       { "saree.sareeType": rx },
// // //       { "saree.fabricType": rx },
// // //       { "saree.weaveType": rx },
// // //       { "saree.occasion": rx },
// // //       { "color.primaryColor": rx },
// // //       { "identity.itemCode": rx },
// // //       { "seo.seoKeywords": rx },
// // //     ];
// // //   }

// // //   const SORTS = {
// // //     newest: "-createdAt",
// // //     price_low: "pricing.sellingPrice",
// // //     price_high: "-pricing.sellingPrice",
// // //     popular: "-salesIntelligence.popularityScore -salesIntelligence.totalViews",
// // //     rating: "-reviews.averageRating",
// // //   };
// // //   const sort = SORTS[req.query.sort] || "-identity.featured -createdAt";

// // //   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
// // //   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);

// // //   const [total, docs] = await Promise.all([
// // //     Item.countDocuments(filter),
// // //     Item.find(filter)
// // //       .select(CARD_FIELDS)
// // //       .sort(sort)
// // //       .skip((page - 1) * limit)
// // //       .limit(limit)
// // //       .lean(),
// // //   ]);

// // //   res.json({
// // //     success: true,
// // //     data: docs.map(toCard),
// // //     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
// // //     seo: catalogMeta(branch, total),
// // //     branch: branch
// // //       ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "", slug: branchSlug(branch) }
// // //       : null,
// // //   });
// // // });

// // // // GET /api/woven-essence/store/facets?branch=
// // // // Filter options built from the live catalogue, so a filter never offers a value
// // // // that returns nothing.
// // // const facets = asyncHandler(async (req, res) => {
// // //   const branch = await resolveBranch(req.query.branch);
// // //   const match = { ...LIVE_ITEM };
// // //   if (branch) match.branch = branch._id;

// // //   const [groups, subgroups, agg] = await Promise.all([
// // //     Group.find({ isDeleted: { $ne: true }, status: "active", ...(branch ? { branch: branch._id } : {}) })
// // //       .select("groupName groupCode")
// // //       .sort("groupName")
// // //       .lean(),
// // //     Subgroup.find({ isDeleted: { $ne: true }, status: "active", ...(branch ? { branch: branch._id } : {}) })
// // //       .select("subgroupName subgroupCode group")
// // //       .sort("subgroupName")
// // //       .lean(),
// // //     Item.aggregate([
// // //       { $match: match },
// // //       {
// // //         $facet: {
// // //           colours: [
// // //             { $group: { _id: "$color.primaryColor", count: { $sum: 1 } } },
// // //             { $match: { _id: { $nin: [null, ""] } } },
// // //             { $sort: { count: -1 } },
// // //             { $limit: 24 },
// // //           ],
// // //           fabrics: [
// // //             { $group: { _id: "$saree.fabricType", count: { $sum: 1 } } },
// // //             { $match: { _id: { $nin: [null, ""] } } },
// // //             { $sort: { count: -1 } },
// // //             { $limit: 24 },
// // //           ],
// // //           sareeTypes: [
// // //             { $group: { _id: "$saree.sareeType", count: { $sum: 1 } } },
// // //             { $match: { _id: { $nin: [null, ""] } } },
// // //             { $sort: { count: -1 } },
// // //             { $limit: 24 },
// // //           ],
// // //           occasions: [
// // //             { $group: { _id: "$saree.occasion", count: { $sum: 1 } } },
// // //             { $match: { _id: { $nin: [null, ""] } } },
// // //             { $sort: { count: -1 } },
// // //             { $limit: 24 },
// // //           ],
// // //           price: [
// // //             {
// // //               $group: {
// // //                 _id: null,
// // //                 min: { $min: "$pricing.sellingPrice" },
// // //                 max: { $max: "$pricing.sellingPrice" },
// // //               },
// // //             },
// // //           ],
// // //         },
// // //       },
// // //     ]),
// // //   ]);

// // //   const bucket = agg[0] || {};
// // //   const shape = (rows) => (rows || []).map((r) => ({ value: r._id, count: r.count }));

// // //   res.json({
// // //     success: true,
// // //     data: {
// // //       groups: groups.map((g) => ({ id: g._id, name: g.groupName, code: g.groupCode })),
// // //       subgroups: subgroups.map((s) => ({
// // //         id: s._id,
// // //         name: s.subgroupName,
// // //         code: s.subgroupCode,
// // //         group: s.group,
// // //       })),
// // //       colours: shape(bucket.colours),
// // //       fabrics: shape(bucket.fabrics),
// // //       sareeTypes: shape(bucket.sareeTypes),
// // //       occasions: shape(bucket.occasions),
// // //       priceRange: {
// // //         min: bucket.price?.[0]?.min ?? null,
// // //         max: bucket.price?.[0]?.max ?? null,
// // //       },
// // //     },
// // //   });
// // // });

// // // // GET /api/woven-essence/store/suggest?q=&branch=
// // // // Powers the search box's live suggestions.
// // // const suggest = asyncHandler(async (req, res) => {
// // //   const q = String(req.query.q || "").trim();
// // //   if (q.length < 2) return res.json({ success: true, data: { products: [], terms: [] } });

// // //   const branch = await resolveBranch(req.query.branch);
// // //   const rx = new RegExp(escapeRegex(q), "i");
// // //   const match = { ...LIVE_ITEM };
// // //   if (branch) match.branch = branch._id;

// // //   const products = await Item.find({
// // //     ...match,
// // //     $or: [
// // //       { "identity.productName": rx },
// // //       { "saree.sareeType": rx },
// // //       { "saree.fabricType": rx },
// // //       { "color.primaryColor": rx },
// // //     ],
// // //   })
// // //     .select(CARD_FIELDS)
// // //     .limit(6)
// // //     .lean();

// // //   const terms = [
// // //     ...new Set(
// // //       products
// // //         .flatMap((p) => [p.saree?.sareeType, p.saree?.fabricType, p.color?.primaryColor])
// // //         .filter((t) => t && rx.test(t))
// // //     ),
// // //   ].slice(0, 6);

// // //   res.json({ success: true, data: { products: products.map(toCard), terms } });
// // // });

// // // // GET /api/woven-essence/store/product/:slug
// // // // Accepts the SEO slug, the raw item code, or the ObjectId.
// // // const productDetail = asyncHandler(async (req, res) => {
// // //   const { slug } = req.params;
// // //   const itemCode = itemCodeFromSlug(slug);

// // //   const or = [{ "seo.slug": slug }];
// // //   if (itemCode) or.push({ "identity.itemCode": itemCode });
// // //   if (/^[a-f\d]{24}$/i.test(slug)) or.push({ _id: slug });
// // //   if (/^[A-Z0-9-]+$/i.test(slug)) or.push({ "identity.itemCode": slug.toUpperCase() });

// // //   const item = await Item.findOne({ ...LIVE_ITEM, $or: or })
// // //     .populate("group", "groupName groupCode")
// // //     .populate("subgroup", "subgroupName subgroupCode")
// // //     .lean();

// // //   if (!item) {
// // //     res.status(404);
// // //     throw new Error("This saree is no longer available");
// // //   }

// // //   const branch = await Branch.findOne({ _id: item.branch, ...LIVE_BRANCH }).lean();

// // //   // Related sarees: same subgroup first, then same fabric, never itself.
// // //   const related = await Item.find({
// // //     ...LIVE_ITEM,
// // //     _id: { $ne: item._id },
// // //     branch: item.branch,
// // //     $or: [
// // //       { subgroup: item.subgroup?._id || item.subgroup },
// // //       { "saree.fabricType": item.saree?.fabricType || "__none__" },
// // //       { "color.primaryColor": item.color?.primaryColor || "__none__" },
// // //     ],
// // //   })
// // //     .select(CARD_FIELDS)
// // //     .limit(8)
// // //     .lean();

// // //   const origin = `${req.protocol}://${req.get("host")}`;
// // //   const meta = productMeta(item, branch);
// // //   const imageUrls = (item.images || []).map((i) => origin + i.url);

// // //   res.json({
// // //     success: true,
// // //     data: {
// // //       id: item._id,
// // //       slug: item.seo?.slug || productSlug(item),
// // //       // Full record minus the fields a shopper has no business seeing.
// // //       identity: item.identity,
// // //       saree: item.saree,
// // //       color: item.color,
// // //       size: item.size,
// // //       pricing: {
// // //         mrp: item.pricing?.mrp ?? null,
// // //         sellingPrice: item.pricing?.sellingPrice ?? null,
// // //         currency: item.pricing?.currency || "INR",
// // //         discountPercent:
// // //           item.pricing?.mrp && item.pricing?.sellingPrice && item.pricing.mrp > item.pricing.sellingPrice
// // //             ? Math.round(((item.pricing.mrp - item.pricing.sellingPrice) / item.pricing.mrp) * 100)
// // //             : null,
// // //         taxInclusive: item.pricing?.taxInclusive ?? true,
// // //       },
// // //       tax: { gstRate: item.tax?.gstRate ?? null, hsnCode: item.tax?.hsnCode || "" },
// // //       care: item.care,
// // //       styling: item.styling,
// // //       shipping: item.shipping,
// // //       returns: item.returns,
// // //       reviews: item.reviews,
// // //       faqs: item.faqs || [],
// // //       variants: item.variants || [],
// // //       images: item.images || [],
// // //       videos: item.videos || [],
// // //       gifs: item.gifs || [],
// // //       documents: item.documents || [],
// // //       stock: {
// // //         inStock: (item.inventory?.currentStock || 0) > 0,
// // //         quantity: item.inventory?.currentStock || 0,
// // //         unit: item.inventory?.unitOfMeasure || "pcs",
// // //       },
// // //       group: item.group,
// // //       subgroup: item.subgroup,
// // //       branch: branch
// // //         ? {
// // //             id: branch._id,
// // //             name: branch.branchName,
// // //             city: branch.address?.city || "",
// // //             state: branch.address?.state || "",
// // //             phone: branch.contact?.phone || "",
// // //             slug: branchSlug(branch),
// // //           }
// // //         : null,
// // //       related: related.map(toCard),
// // //       seo: { ...meta, jsonLd: productJsonLd(item, branch, origin + meta.canonicalPath, imageUrls) },
// // //     },
// // //   });
// // // });

// // // // POST /api/woven-essence/store/product/:id/view
// // // // Feeds Section 32 so the admin's "which product is most viewed" reporting has
// // // // real numbers instead of zeros. Fire-and-forget: never blocks the page.
// // // const recordView = asyncHandler(async (req, res) => {
// // //   const { id } = req.params;
// // //   if (!/^[a-f\d]{24}$/i.test(id)) {
// // //     res.status(400);
// // //     throw new Error("Invalid product id");
// // //   }

// // //   const seconds = Math.min(Math.max(parseInt(req.body?.seconds, 10) || 0, 0), 3600);

// // //   await Item.updateOne(
// // //     { _id: id, ...LIVE_ITEM },
// // //     {
// // //       $inc: {
// // //         "salesIntelligence.totalViews": 1,
// // //         "salesIntelligence.popularityScore": 1 + Math.floor(seconds / 30),
// // //       },
// // //     }
// // //   );

// // //   res.json({ success: true });
// // // });

// // // module.exports = {
// // //   listBranches,
// // //   catalog,
// // //   facets,
// // //   suggest,
// // //   productDetail,
// // //   recordView,
// // // };









// // const asyncHandler = require("express-async-handler");
// // const Branch = require("../models/Branch");
// // const Group = require("../models/Group");
// // const Subgroup = require("../models/Subgroup");
// // const Item = require("../models/Item");
// // const Visit = require("../models/Visit");
// // const {
// //   productSlug,
// //   branchSlug,
// //   itemCodeFromSlug,
// //   productMeta,
// //   catalogMeta,
// //   productJsonLd,
// // } = require("../utils/storeSeo");

// // /**
// //  * Public storefront API — no authentication, read-only.
// //  *
// //  * Visibility rule, applied to every query in this file: a saree reaches the
// //  * storefront only if it is active, published, not deleted, and its
// //  * visibility.onlineSaleEnabled is not false. The admin's draft/hold workflow is
// //  * therefore a real gate, not decoration.
// //  */

// // const LIVE_ITEM = {
// //   isDeleted: { $ne: true },
// //   status: "active",
// //   lifecycleStage: "published",
// //   "visibility.onlineSaleEnabled": { $ne: false },
// // };

// // const LIVE_BRANCH = {
// //   isDeleted: { $ne: true },
// //   status: "active",
// // };

// // /** Fields the catalog grid needs — deliberately narrow, these lists get long. */
// // const CARD_FIELDS = {
// //   "identity.productName": 1,
// //   "identity.displayName": 1,
// //   "identity.itemCode": 1,
// //   "identity.brand": 1,
// //   "identity.category": 1,
// //   "identity.featured": 1,
// //   "identity.newArrival": 1,
// //   "identity.bestSeller": 1,
// //   "identity.trending": 1,
// //   "saree.sareeType": 1,
// //   "saree.fabricType": 1,
// //   "saree.primaryFabric": 1,
// //   "saree.handloomStatus": 1,
// //   "saree.occasion": 1,
// //   "color.primaryColor": 1,
// //   "pricing.mrp": 1,
// //   "pricing.sellingPrice": 1,
// //   "pricing.discountPercent": 1,
// //   "pricing.currency": 1,
// //   "inventory.currentStock": 1,
// //   "reviews.averageRating": 1,
// //   "reviews.totalReviews": 1,
// //   "seo.slug": 1,
// //   images: 1,
// //   branch: 1,
// //   group: 1,
// //   subgroup: 1,
// //   createdAt: 1,
// // };

// // function escapeRegex(text) {
// //   return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// // }

// // /** Shapes a catalog card, including its SEO slug and a single hero image. */
// // function toCard(item) {
// //   const images = Array.isArray(item.images) ? item.images : [];
// //   const hero =
// //     images.find((i) => i.category === "Main Product Image") || images[0] || null;

// //   const mrp = item.pricing?.mrp;
// //   const selling = item.pricing?.sellingPrice;
// //   const discountPercent =
// //     mrp && selling && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null;

// //   return {
// //     id: item._id,
// //     slug: item.seo?.slug || productSlug(item),
// //     itemCode: item.identity?.itemCode || "",
// //     name: item.identity?.displayName || item.identity?.productName || "Saree",
// //     brand: item.identity?.brand || "Woven Essence",
// //     sareeType: item.saree?.sareeType || "",
// //     fabric: item.saree?.fabricType || item.saree?.primaryFabric || "",
// //     handloom: item.saree?.handloomStatus === "handloom",
// //     occasion: item.saree?.occasion || "",
// //     colour: item.color?.primaryColor || "",
// //     mrp: mrp ?? null,
// //     sellingPrice: selling ?? null,
// //     discountPercent,
// //     currency: item.pricing?.currency || "INR",
// //     inStock: (item.inventory?.currentStock || 0) > 0,
// //     rating: item.reviews?.averageRating || 0,
// //     reviewCount: item.reviews?.totalReviews || 0,
// //     image: hero ? { url: hero.url, altText: hero.altText || item.identity?.productName } : null,
// //     imageCount: images.length,
// //     badges: [
// //       item.identity?.bestSeller && "Best seller",
// //       item.identity?.newArrival && "New arrival",
// //       item.identity?.trending && "Trending",
// //       item.identity?.featured && "Featured",
// //     ].filter(Boolean),
// //   };
// // }

// // // GET /api/woven-essence/store/branches
// // // The landing page's branch chooser. Only branches a shopper can actually buy from.
// // const listBranches = asyncHandler(async (req, res) => {
// //   const branches = await Branch.find(LIVE_BRANCH)
// //     .select("branchName branchCode address location contact")
// //     .sort("branchName")
// //     .lean();

// //   const withCounts = await Promise.all(
// //     branches.map(async (branch) => {
// //       const productCount = await Item.countDocuments({ ...LIVE_ITEM, branch: branch._id });
// //       return {
// //         id: branch._id,
// //         name: branch.branchName,
// //         code: branch.branchCode,
// //         slug: branchSlug(branch),
// //         city: branch.address?.city || "",
// //         state: branch.address?.state || "",
// //         pincode: branch.address?.pincode || "",
// //         phone: branch.contact?.phone || "",
// //         location: branch.location || null,
// //         productCount,
// //       };
// //     })
// //   );

// //   res.json({ success: true, data: withCounts });
// // });

// // /** Resolves a branch by id or SEO slug. */
// // async function resolveBranch(idOrSlug) {
// //   if (!idOrSlug) return null;
// //   if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
// //     return Branch.findOne({ _id: idOrSlug, ...LIVE_BRANCH }).lean();
// //   }
// //   const code = String(idOrSlug).match(/(tf-\d{4})$/i);
// //   if (code) {
// //     return Branch.findOne({ branchCode: code[1].toUpperCase(), ...LIVE_BRANCH }).lean();
// //   }
// //   return null;
// // }

// // // GET /api/woven-essence/store/catalog
// // // Query: branch, q, group, subgroup, colour, fabric, sareeType, occasion,
// // //        minPrice, maxPrice, sort, page, limit
// // const catalog = asyncHandler(async (req, res) => {
// //   const branch = await resolveBranch(req.query.branch);
// //   if (req.query.branch && !branch) {
// //     res.status(404);
// //     throw new Error("Branch not found or not open for online orders");
// //   }

// //   const filter = { ...LIVE_ITEM };
// //   if (branch) filter.branch = branch._id;

// //   if (req.query.group) filter.group = req.query.group;
// //   if (req.query.subgroup) filter.subgroup = req.query.subgroup;

// //   // Attribute facets, matched case-insensitively so "Ruby Red" and "ruby red" agree.
// //   const facetMap = {
// //     colour: "color.primaryColor",
// //     fabric: "saree.fabricType",
// //     sareeType: "saree.sareeType",
// //     occasion: "saree.occasion",
// //   };
// //   Object.entries(facetMap).forEach(([param, path]) => {
// //     const value = req.query[param];
// //     if (value) filter[path] = new RegExp(`^${escapeRegex(value)}$`, "i");
// //   });

// //   if (req.query.handloom === "true") filter["saree.handloomStatus"] = "handloom";
// //   if (req.query.inStock === "true") filter["inventory.currentStock"] = { $gt: 0 };

// //   const min = Number(req.query.minPrice);
// //   const max = Number(req.query.maxPrice);
// //   if (!Number.isNaN(min) || !Number.isNaN(max)) {
// //     filter["pricing.sellingPrice"] = {};
// //     if (!Number.isNaN(min)) filter["pricing.sellingPrice"].$gte = min;
// //     if (!Number.isNaN(max)) filter["pricing.sellingPrice"].$lte = max;
// //   }

// //   // Search across the fields a shopper would actually type.
// //   if (req.query.q) {
// //     const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
// //     filter.$or = [
// //       { "identity.productName": rx },
// //       { "identity.displayName": rx },
// //       { "identity.shortDescription": rx },
// //       { "identity.category": rx },
// //       { "identity.collectionName": rx },
// //       { "saree.sareeType": rx },
// //       { "saree.fabricType": rx },
// //       { "saree.weaveType": rx },
// //       { "saree.occasion": rx },
// //       { "color.primaryColor": rx },
// //       { "identity.itemCode": rx },
// //       { "seo.seoKeywords": rx },
// //     ];
// //   }

// //   const SORTS = {
// //     newest: "-createdAt",
// //     price_low: "pricing.sellingPrice",
// //     price_high: "-pricing.sellingPrice",
// //     popular: "-salesIntelligence.popularityScore -salesIntelligence.totalViews",
// //     rating: "-reviews.averageRating",
// //   };
// //   const sort = SORTS[req.query.sort] || "-identity.featured -createdAt";

// //   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
// //   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);

// //   const [total, docs] = await Promise.all([
// //     Item.countDocuments(filter),
// //     Item.find(filter)
// //       .select(CARD_FIELDS)
// //       .sort(sort)
// //       .skip((page - 1) * limit)
// //       .limit(limit)
// //       .lean(),
// //   ]);

// //   res.json({
// //     success: true,
// //     data: docs.map(toCard),
// //     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
// //     seo: catalogMeta(branch, total),
// //     branch: branch
// //       ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "", slug: branchSlug(branch) }
// //       : null,
// //   });
// // });

// // // GET /api/woven-essence/store/facets?branch=
// // // Filter options built from the live catalogue, so a filter never offers a value
// // // that returns nothing.
// // const facets = asyncHandler(async (req, res) => {
// //   const branch = await resolveBranch(req.query.branch);
// //   const match = { ...LIVE_ITEM };
// //   if (branch) match.branch = branch._id;

// //   const [groups, subgroups, agg] = await Promise.all([
// //     Group.find({ isDeleted: { $ne: true }, status: "active", ...(branch ? { branch: branch._id } : {}) })
// //       .select("groupName groupCode")
// //       .sort("groupName")
// //       .lean(),
// //     Subgroup.find({ isDeleted: { $ne: true }, status: "active", ...(branch ? { branch: branch._id } : {}) })
// //       .select("subgroupName subgroupCode group")
// //       .sort("subgroupName")
// //       .lean(),
// //     Item.aggregate([
// //       { $match: match },
// //       {
// //         $facet: {
// //           colours: [
// //             { $group: { _id: "$color.primaryColor", count: { $sum: 1 } } },
// //             { $match: { _id: { $nin: [null, ""] } } },
// //             { $sort: { count: -1 } },
// //             { $limit: 24 },
// //           ],
// //           fabrics: [
// //             { $group: { _id: "$saree.fabricType", count: { $sum: 1 } } },
// //             { $match: { _id: { $nin: [null, ""] } } },
// //             { $sort: { count: -1 } },
// //             { $limit: 24 },
// //           ],
// //           sareeTypes: [
// //             { $group: { _id: "$saree.sareeType", count: { $sum: 1 } } },
// //             { $match: { _id: { $nin: [null, ""] } } },
// //             { $sort: { count: -1 } },
// //             { $limit: 24 },
// //           ],
// //           occasions: [
// //             { $group: { _id: "$saree.occasion", count: { $sum: 1 } } },
// //             { $match: { _id: { $nin: [null, ""] } } },
// //             { $sort: { count: -1 } },
// //             { $limit: 24 },
// //           ],
// //           price: [
// //             {
// //               $group: {
// //                 _id: null,
// //                 min: { $min: "$pricing.sellingPrice" },
// //                 max: { $max: "$pricing.sellingPrice" },
// //               },
// //             },
// //           ],
// //         },
// //       },
// //     ]),
// //   ]);

// //   const bucket = agg[0] || {};
// //   const shape = (rows) => (rows || []).map((r) => ({ value: r._id, count: r.count }));

// //   res.json({
// //     success: true,
// //     data: {
// //       groups: groups.map((g) => ({ id: g._id, name: g.groupName, code: g.groupCode })),
// //       subgroups: subgroups.map((s) => ({
// //         id: s._id,
// //         name: s.subgroupName,
// //         code: s.subgroupCode,
// //         group: s.group,
// //       })),
// //       colours: shape(bucket.colours),
// //       fabrics: shape(bucket.fabrics),
// //       sareeTypes: shape(bucket.sareeTypes),
// //       occasions: shape(bucket.occasions),
// //       priceRange: {
// //         min: bucket.price?.[0]?.min ?? null,
// //         max: bucket.price?.[0]?.max ?? null,
// //       },
// //     },
// //   });
// // });

// // // GET /api/woven-essence/store/suggest?q=&branch=
// // // Powers the search box's live suggestions.
// // const suggest = asyncHandler(async (req, res) => {
// //   const q = String(req.query.q || "").trim();
// //   if (q.length < 2) return res.json({ success: true, data: { products: [], terms: [] } });

// //   const branch = await resolveBranch(req.query.branch);
// //   const rx = new RegExp(escapeRegex(q), "i");
// //   const match = { ...LIVE_ITEM };
// //   if (branch) match.branch = branch._id;

// //   const products = await Item.find({
// //     ...match,
// //     $or: [
// //       { "identity.productName": rx },
// //       { "saree.sareeType": rx },
// //       { "saree.fabricType": rx },
// //       { "color.primaryColor": rx },
// //     ],
// //   })
// //     .select(CARD_FIELDS)
// //     .limit(6)
// //     .lean();

// //   const terms = [
// //     ...new Set(
// //       products
// //         .flatMap((p) => [p.saree?.sareeType, p.saree?.fabricType, p.color?.primaryColor])
// //         .filter((t) => t && rx.test(t))
// //     ),
// //   ].slice(0, 6);

// //   res.json({ success: true, data: { products: products.map(toCard), terms } });
// // });

// // // GET /api/woven-essence/store/product/:slug
// // // Accepts the SEO slug, the raw item code, or the ObjectId.
// // const productDetail = asyncHandler(async (req, res) => {
// //   const { slug } = req.params;
// //   const itemCode = itemCodeFromSlug(slug);

// //   const or = [{ "seo.slug": slug }];
// //   if (itemCode) or.push({ "identity.itemCode": itemCode });
// //   if (/^[a-f\d]{24}$/i.test(slug)) or.push({ _id: slug });
// //   if (/^[A-Z0-9-]+$/i.test(slug)) or.push({ "identity.itemCode": slug.toUpperCase() });

// //   const item = await Item.findOne({ ...LIVE_ITEM, $or: or })
// //     .populate("group", "groupName groupCode")
// //     .populate("subgroup", "subgroupName subgroupCode")
// //     .lean();

// //   if (!item) {
// //     res.status(404);
// //     throw new Error("This saree is no longer available");
// //   }

// //   const branch = await Branch.findOne({ _id: item.branch, ...LIVE_BRANCH }).lean();

// //   // Related sarees: same subgroup first, then same fabric, never itself.
// //   const related = await Item.find({
// //     ...LIVE_ITEM,
// //     _id: { $ne: item._id },
// //     branch: item.branch,
// //     $or: [
// //       { subgroup: item.subgroup?._id || item.subgroup },
// //       { "saree.fabricType": item.saree?.fabricType || "__none__" },
// //       { "color.primaryColor": item.color?.primaryColor || "__none__" },
// //     ],
// //   })
// //     .select(CARD_FIELDS)
// //     .limit(8)
// //     .lean();

// //   const origin = `${req.protocol}://${req.get("host")}`;
// //   const meta = productMeta(item, branch);
// //   const imageUrls = (item.images || []).map((i) => origin + i.url);

// //   res.json({
// //     success: true,
// //     data: {
// //       id: item._id,
// //       slug: item.seo?.slug || productSlug(item),
// //       // Full record minus the fields a shopper has no business seeing.
// //       identity: item.identity,
// //       saree: item.saree,
// //       color: item.color,
// //       size: item.size,
// //       pricing: {
// //         mrp: item.pricing?.mrp ?? null,
// //         sellingPrice: item.pricing?.sellingPrice ?? null,
// //         currency: item.pricing?.currency || "INR",
// //         discountPercent:
// //           item.pricing?.mrp && item.pricing?.sellingPrice && item.pricing.mrp > item.pricing.sellingPrice
// //             ? Math.round(((item.pricing.mrp - item.pricing.sellingPrice) / item.pricing.mrp) * 100)
// //             : null,
// //         taxInclusive: item.pricing?.taxInclusive ?? true,
// //       },
// //       tax: { gstRate: item.tax?.gstRate ?? null, hsnCode: item.tax?.hsnCode || "" },
// //       care: item.care,
// //       styling: item.styling,
// //       shipping: item.shipping,
// //       returns: item.returns,
// //       reviews: item.reviews,
// //       faqs: item.faqs || [],
// //       variants: item.variants || [],
// //       images: item.images || [],
// //       videos: item.videos || [],
// //       gifs: item.gifs || [],
// //       documents: item.documents || [],
// //       stock: {
// //         inStock: (item.inventory?.currentStock || 0) > 0,
// //         quantity: item.inventory?.currentStock || 0,
// //         unit: item.inventory?.unitOfMeasure || "pcs",
// //       },
// //       group: item.group,
// //       subgroup: item.subgroup,
// //       branch: branch
// //         ? {
// //             id: branch._id,
// //             name: branch.branchName,
// //             city: branch.address?.city || "",
// //             state: branch.address?.state || "",
// //             phone: branch.contact?.phone || "",
// //             slug: branchSlug(branch),
// //           }
// //         : null,
// //       related: related.map(toCard),
// //       seo: { ...meta, jsonLd: productJsonLd(item, branch, origin + meta.canonicalPath, imageUrls) },
// //     },
// //   });
// // });

// // // POST /api/woven-essence/store/product/:id/view
// // // Feeds Section 32 so the admin's "which product is most viewed" reporting has
// // // real numbers instead of zeros. Fire-and-forget: never blocks the page.
// // const recordView = asyncHandler(async (req, res) => {
// //   const { id } = req.params;
// //   if (!/^[a-f\d]{24}$/i.test(id)) {
// //     res.status(400);
// //     throw new Error("Invalid product id");
// //   }

// //   const seconds = Math.min(Math.max(parseInt(req.body?.seconds, 10) || 0, 0), 3600);

// //   await Item.updateOne(
// //     { _id: id, ...LIVE_ITEM },
// //     {
// //       $inc: {
// //         "salesIntelligence.totalViews": 1,
// //         "salesIntelligence.popularityScore": 1 + Math.floor(seconds / 30),
// //       },
// //     }
// //   );

// //   res.json({ success: true });
// // });

// // // POST /api/woven-essence/store/visit   { pageType, branch?, firstHit? }
// // // Anonymous traffic counter. No IP, no user agent, no identifier of any kind is
// // // stored — see models/Visit.js. Fire-and-forget from the browser.
// // const recordVisit = asyncHandler(async (req, res) => {
// //   const ALLOWED = ["home", "catalog", "product", "cart", "checkout", "account", "other"];
// //   const pageType = ALLOWED.includes(req.body?.pageType) ? req.body.pageType : "other";
// //   const branch = /^[a-f\d]{24}$/i.test(String(req.body?.branch || "")) ? req.body.branch : null;

// //   await Visit.updateOne(
// //     { day: Visit.dayKey(), branch, pageType },
// //     { $inc: { views: 1, sessions: req.body?.firstHit ? 1 : 0 } },
// //     { upsert: true }
// //   );

// //   res.status(202).json({ success: true });
// // });

// // module.exports = {
// //   recordVisit,
// //   listBranches,
// //   catalog,
// //   facets,
// //   suggest,
// //   productDetail,
// //   recordView,
// // };




















// const asyncHandler = require("express-async-handler");
// const Branch = require("../models/Branch");
// const Group = require("../models/Group");
// const Subgroup = require("../models/Subgroup");
// const Item = require("../models/Item");
// const Visit = require("../models/Visit");
// const {
//   productSlug,
//   branchSlug,
//   itemCodeFromSlug,
//   productMeta,
//   catalogMeta,
//   productJsonLd,
// } = require("../utils/storeSeo");

// /**
//  * Public storefront API — no authentication, read-only.
//  *
//  * Visibility rule, applied to every query in this file: a saree reaches the
//  * storefront only if it is active, published, not deleted, and its
//  * visibility.onlineSaleEnabled is not false. The admin's draft/hold workflow is
//  * therefore a real gate, not decoration.
//  */

// const LIVE_ITEM = {
//   isDeleted: { $ne: true },
//   status: "active",
//   lifecycleStage: "published",
//   "visibility.onlineSaleEnabled": { $ne: false },
// };

// const LIVE_BRANCH = {
//   isDeleted: { $ne: true },
//   status: "active",
// };

// /** Fields the catalog grid needs — deliberately narrow, these lists get long. */
// const CARD_FIELDS = {
//   "identity.productName": 1,
//   "identity.displayName": 1,
//   "identity.itemCode": 1,
//   "identity.brand": 1,
//   "identity.category": 1,
//   "identity.featured": 1,
//   "identity.newArrival": 1,
//   "identity.bestSeller": 1,
//   "identity.trending": 1,
//   "saree.sareeType": 1,
//   "saree.fabricType": 1,
//   "saree.primaryFabric": 1,
//   "saree.handloomStatus": 1,
//   "saree.occasion": 1,
//   "color.primaryColor": 1,
//   "pricing.mrp": 1,
//   "pricing.sellingPrice": 1,
//   "pricing.discountPercent": 1,
//   "pricing.currency": 1,
//   "inventory.currentStock": 1,
//   "reviews.averageRating": 1,
//   "reviews.totalReviews": 1,
//   "seo.slug": 1,
//   images: 1,
//   branch: 1,
//   group: 1,
//   subgroup: 1,
//   createdAt: 1,
// };

// function escapeRegex(text) {
//   return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// }

// /** Shapes a catalog card, including its SEO slug and a single hero image. */
// function toCard(item) {
//   const images = Array.isArray(item.images) ? item.images : [];
//   const hero =
//     images.find((i) => i.category === "Main Product Image") || images[0] || null;

//   const mrp = item.pricing?.mrp;
//   const selling = item.pricing?.sellingPrice;
//   const discountPercent =
//     mrp && selling && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null;

//   // When several stores are being browsed the grid has to say which shop each
//   // saree is in — otherwise a shopper can't tell why two similar pieces differ
//   // in price, or which store an add-to-cart would pin them to.
//   const branchDoc = item.branch && typeof item.branch === "object" ? item.branch : null;

//   return {
//     id: item._id,
//     slug: item.seo?.slug || productSlug(item),
//     itemCode: item.identity?.itemCode || "",
//     branchId: branchDoc ? branchDoc._id : item.branch,
//     branchName: branchDoc?.branchName || "",
//     branchCity: branchDoc?.address?.city || "",
//     name: item.identity?.displayName || item.identity?.productName || "Saree",
//     brand: item.identity?.brand || "Woven Essence",
//     sareeType: item.saree?.sareeType || "",
//     fabric: item.saree?.fabricType || item.saree?.primaryFabric || "",
//     handloom: item.saree?.handloomStatus === "handloom",
//     occasion: item.saree?.occasion || "",
//     colour: item.color?.primaryColor || "",
//     mrp: mrp ?? null,
//     sellingPrice: selling ?? null,
//     discountPercent,
//     currency: item.pricing?.currency || "INR",
//     inStock: (item.inventory?.currentStock || 0) > 0,
//     rating: item.reviews?.averageRating || 0,
//     reviewCount: item.reviews?.totalReviews || 0,
//     image: hero ? { url: hero.url, altText: hero.altText || item.identity?.productName } : null,
//     imageCount: images.length,
//     badges: [
//       item.identity?.bestSeller && "Best seller",
//       item.identity?.newArrival && "New arrival",
//       item.identity?.trending && "Trending",
//       item.identity?.featured && "Featured",
//     ].filter(Boolean),
//   };
// }

// // GET /api/woven-essence/store/branches
// // The landing page's branch chooser. Only branches a shopper can actually buy from.
// const listBranches = asyncHandler(async (req, res) => {
//   const branches = await Branch.find(LIVE_BRANCH)
//     .select("branchName branchCode address location contact")
//     .sort("branchName")
//     .lean();

//   const withCounts = await Promise.all(
//     branches.map(async (branch) => {
//       const productCount = await Item.countDocuments({ ...LIVE_ITEM, branch: branch._id });
//       return {
//         id: branch._id,
//         name: branch.branchName,
//         code: branch.branchCode,
//         slug: branchSlug(branch),
//         city: branch.address?.city || "",
//         state: branch.address?.state || "",
//         pincode: branch.address?.pincode || "",
//         phone: branch.contact?.phone || "",
//         location: branch.location || null,
//         productCount,
//       };
//     })
//   );

//   res.json({ success: true, data: withCounts });
// });

// /** Resolves a branch by id or SEO slug. */
// /**
//  * Resolves a `branch` query value that may name SEVERAL stores.
//  *
//  * Browsing across stores is useful — a shopper comparing Bengaluru and Chennai
//  * stock shouldn't have to flip back and forth. Buying across stores is not:
//  * an order is raised against one branch, with its own stock, pricing and
//  * shipment, so the cart stays single-store (enforced in cartController). This
//  * helper therefore only ever widens what is LISTED.
//  *
//  * Accepts "id", "slug", or "id,id,slug". Unknown entries are dropped rather
//  * than failing the whole request, so one stale id in a shared link doesn't
//  * blank the page.
//  */
// async function resolveBranches(param) {
//   const parts = String(param || "")
//     .split(",")
//     .map((p) => p.trim())
//     .filter(Boolean)
//     .slice(0, 20); // a sane ceiling on how many stores one query can span

//   if (parts.length === 0) return [];

//   const resolved = await Promise.all(parts.map((p) => resolveBranch(p)));
//   const seen = new Set();
//   return resolved.filter((b) => {
//     if (!b) return false;
//     const key = String(b._id);
//     if (seen.has(key)) return false;
//     seen.add(key);
//     return true;
//   });
// }

// /** Mongo filter for a resolved branch list: exact match for one, $in for many. */
// function branchFilterFor(branches) {
//   if (branches.length === 0) return null;
//   if (branches.length === 1) return branches[0]._id;
//   return { $in: branches.map((b) => b._id) };
// }

// async function resolveBranch(idOrSlug) {
//   if (!idOrSlug) return null;
//   if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
//     return Branch.findOne({ _id: idOrSlug, ...LIVE_BRANCH }).lean();
//   }
//   const code = String(idOrSlug).match(/(tf-\d{4})$/i);
//   if (code) {
//     return Branch.findOne({ branchCode: code[1].toUpperCase(), ...LIVE_BRANCH }).lean();
//   }
//   return null;
// }

// // GET /api/woven-essence/store/catalog
// // Query: branch, q, group, subgroup, colour, fabric, sareeType, occasion,
// //        minPrice, maxPrice, sort, page, limit
// const catalog = asyncHandler(async (req, res) => {
//   const branches = await resolveBranches(req.query.branch);
//   if (req.query.branch && branches.length === 0) {
//     res.status(404);
//     throw new Error("Branch not found or not open for online orders");
//   }
//   const branch = branches.length === 1 ? branches[0] : null;

//   const filter = { ...LIVE_ITEM };
//   const branchClause = branchFilterFor(branches);
//   if (branchClause) filter.branch = branchClause;

//   if (req.query.group) filter.group = req.query.group;
//   if (req.query.subgroup) filter.subgroup = req.query.subgroup;

//   // Attribute facets, matched case-insensitively so "Ruby Red" and "ruby red" agree.
//   const facetMap = {
//     colour: "color.primaryColor",
//     fabric: "saree.fabricType",
//     sareeType: "saree.sareeType",
//     occasion: "saree.occasion",
//   };
//   Object.entries(facetMap).forEach(([param, path]) => {
//     const value = req.query[param];
//     if (value) filter[path] = new RegExp(`^${escapeRegex(value)}$`, "i");
//   });

//   if (req.query.handloom === "true") filter["saree.handloomStatus"] = "handloom";
//   if (req.query.inStock === "true") filter["inventory.currentStock"] = { $gt: 0 };

//   const min = Number(req.query.minPrice);
//   const max = Number(req.query.maxPrice);
//   if (!Number.isNaN(min) || !Number.isNaN(max)) {
//     filter["pricing.sellingPrice"] = {};
//     if (!Number.isNaN(min)) filter["pricing.sellingPrice"].$gte = min;
//     if (!Number.isNaN(max)) filter["pricing.sellingPrice"].$lte = max;
//   }

//   // Search across the fields a shopper would actually type.
//   if (req.query.q) {
//     const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
//     filter.$or = [
//       { "identity.productName": rx },
//       { "identity.displayName": rx },
//       { "identity.shortDescription": rx },
//       { "identity.category": rx },
//       { "identity.collectionName": rx },
//       { "saree.sareeType": rx },
//       { "saree.fabricType": rx },
//       { "saree.weaveType": rx },
//       { "saree.occasion": rx },
//       { "color.primaryColor": rx },
//       { "identity.itemCode": rx },
//       { "seo.seoKeywords": rx },
//     ];
//   }

//   const SORTS = {
//     newest: "-createdAt",
//     price_low: "pricing.sellingPrice",
//     price_high: "-pricing.sellingPrice",
//     popular: "-salesIntelligence.popularityScore -salesIntelligence.totalViews",
//     rating: "-reviews.averageRating",
//   };
//   const sort = SORTS[req.query.sort] || "-identity.featured -createdAt";

//   const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
//   const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);

//   const [total, docs] = await Promise.all([
//     Item.countDocuments(filter),
//     Item.find(filter)
//       .select(CARD_FIELDS)
//       .populate("branch", "branchName address.city")
//       .sort(sort)
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean(),
//   ]);

//   res.json({
//     success: true,
//     data: docs.map(toCard),
//     pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
//     seo: catalogMeta(branch, total, branches.length),
//     branch: branch
//       ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "", slug: branchSlug(branch) }
//       : null,
//     // Every store the results span, so the UI can say "across 3 stores" and
//     // attribute each card without a second request.
//     branches: branches.map((b) => ({
//       id: b._id,
//       name: b.branchName,
//       city: b.address?.city || "",
//       slug: branchSlug(b),
//     })),
//   });
// });

// // GET /api/woven-essence/store/facets?branch=
// // Filter options built from the live catalogue, so a filter never offers a value
// // that returns nothing.
// const facets = asyncHandler(async (req, res) => {
//   const branches = await resolveBranches(req.query.branch);
//   const match = { ...LIVE_ITEM };
//   const branchClause = branchFilterFor(branches);
//   if (branchClause) match.branch = branchClause;

//   const [groups, subgroups, agg] = await Promise.all([
//     Group.find({ isDeleted: { $ne: true }, status: "active", ...(branchClause ? { branch: branchClause } : {}) })
//       .select("groupName groupCode")
//       .sort("groupName")
//       .lean(),
//     Subgroup.find({ isDeleted: { $ne: true }, status: "active", ...(branchClause ? { branch: branchClause } : {}) })
//       .select("subgroupName subgroupCode group")
//       .sort("subgroupName")
//       .lean(),
//     Item.aggregate([
//       { $match: match },
//       {
//         $facet: {
//           colours: [
//             { $group: { _id: "$color.primaryColor", count: { $sum: 1 } } },
//             { $match: { _id: { $nin: [null, ""] } } },
//             { $sort: { count: -1 } },
//             { $limit: 24 },
//           ],
//           fabrics: [
//             { $group: { _id: "$saree.fabricType", count: { $sum: 1 } } },
//             { $match: { _id: { $nin: [null, ""] } } },
//             { $sort: { count: -1 } },
//             { $limit: 24 },
//           ],
//           sareeTypes: [
//             { $group: { _id: "$saree.sareeType", count: { $sum: 1 } } },
//             { $match: { _id: { $nin: [null, ""] } } },
//             { $sort: { count: -1 } },
//             { $limit: 24 },
//           ],
//           occasions: [
//             { $group: { _id: "$saree.occasion", count: { $sum: 1 } } },
//             { $match: { _id: { $nin: [null, ""] } } },
//             { $sort: { count: -1 } },
//             { $limit: 24 },
//           ],
//           price: [
//             {
//               $group: {
//                 _id: null,
//                 min: { $min: "$pricing.sellingPrice" },
//                 max: { $max: "$pricing.sellingPrice" },
//               },
//             },
//           ],
//         },
//       },
//     ]),
//   ]);

//   const bucket = agg[0] || {};
//   const shape = (rows) => (rows || []).map((r) => ({ value: r._id, count: r.count }));

//   res.json({
//     success: true,
//     data: {
//       groups: groups.map((g) => ({ id: g._id, name: g.groupName, code: g.groupCode })),
//       subgroups: subgroups.map((s) => ({
//         id: s._id,
//         name: s.subgroupName,
//         code: s.subgroupCode,
//         group: s.group,
//       })),
//       colours: shape(bucket.colours),
//       fabrics: shape(bucket.fabrics),
//       sareeTypes: shape(bucket.sareeTypes),
//       occasions: shape(bucket.occasions),
//       priceRange: {
//         min: bucket.price?.[0]?.min ?? null,
//         max: bucket.price?.[0]?.max ?? null,
//       },
//     },
//   });
// });

// // GET /api/woven-essence/store/suggest?q=&branch=
// // Powers the search box's live suggestions.
// const suggest = asyncHandler(async (req, res) => {
//   const q = String(req.query.q || "").trim();
//   if (q.length < 2) return res.json({ success: true, data: { products: [], terms: [] } });

//   const branches = await resolveBranches(req.query.branch);
//   const rx = new RegExp(escapeRegex(q), "i");
//   const match = { ...LIVE_ITEM };
//   const branchClause = branchFilterFor(branches);
//   if (branchClause) match.branch = branchClause;

//   const products = await Item.find({
//     ...match,
//     $or: [
//       { "identity.productName": rx },
//       { "saree.sareeType": rx },
//       { "saree.fabricType": rx },
//       { "color.primaryColor": rx },
//     ],
//   })
//     .select(CARD_FIELDS)
//     .populate("branch", "branchName address.city")
//     .limit(6)
//     .lean();

//   const terms = [
//     ...new Set(
//       products
//         .flatMap((p) => [p.saree?.sareeType, p.saree?.fabricType, p.color?.primaryColor])
//         .filter((t) => t && rx.test(t))
//     ),
//   ].slice(0, 6);

//   res.json({ success: true, data: { products: products.map(toCard), terms } });
// });

// // GET /api/woven-essence/store/product/:slug
// // Accepts the SEO slug, the raw item code, or the ObjectId.
// const productDetail = asyncHandler(async (req, res) => {
//   const { slug } = req.params;
//   const itemCode = itemCodeFromSlug(slug);

//   const or = [{ "seo.slug": slug }];
//   if (itemCode) or.push({ "identity.itemCode": itemCode });
//   if (/^[a-f\d]{24}$/i.test(slug)) or.push({ _id: slug });
//   if (/^[A-Z0-9-]+$/i.test(slug)) or.push({ "identity.itemCode": slug.toUpperCase() });

//   const item = await Item.findOne({ ...LIVE_ITEM, $or: or })
//     .populate("group", "groupName groupCode")
//     .populate("subgroup", "subgroupName subgroupCode")
//     .lean();

//   if (!item) {
//     res.status(404);
//     throw new Error("This saree is no longer available");
//   }

//   const branch = await Branch.findOne({ _id: item.branch, ...LIVE_BRANCH }).lean();

//   // Related sarees: same subgroup first, then same fabric, never itself.
//   const related = await Item.find({
//     ...LIVE_ITEM,
//     _id: { $ne: item._id },
//     branch: item.branch,
//     $or: [
//       { subgroup: item.subgroup?._id || item.subgroup },
//       { "saree.fabricType": item.saree?.fabricType || "__none__" },
//       { "color.primaryColor": item.color?.primaryColor || "__none__" },
//     ],
//   })
//     .select(CARD_FIELDS)
//     .populate("branch", "branchName address.city")
//     .limit(8)
//     .lean();

//   const origin = `${req.protocol}://${req.get("host")}`;
//   const meta = productMeta(item, branch);
//   const imageUrls = (item.images || []).map((i) => origin + i.url);

//   res.json({
//     success: true,
//     data: {
//       id: item._id,
//       slug: item.seo?.slug || productSlug(item),
//       // Full record minus the fields a shopper has no business seeing.
//       identity: item.identity,
//       saree: item.saree,
//       color: item.color,
//       size: item.size,
//       pricing: {
//         mrp: item.pricing?.mrp ?? null,
//         sellingPrice: item.pricing?.sellingPrice ?? null,
//         currency: item.pricing?.currency || "INR",
//         discountPercent:
//           item.pricing?.mrp && item.pricing?.sellingPrice && item.pricing.mrp > item.pricing.sellingPrice
//             ? Math.round(((item.pricing.mrp - item.pricing.sellingPrice) / item.pricing.mrp) * 100)
//             : null,
//         taxInclusive: item.pricing?.taxInclusive ?? true,
//       },
//       tax: { gstRate: item.tax?.gstRate ?? null, hsnCode: item.tax?.hsnCode || "" },
//       care: item.care,
//       styling: item.styling,
//       shipping: item.shipping,
//       returns: item.returns,
//       reviews: item.reviews,
//       faqs: item.faqs || [],
//       variants: item.variants || [],
//       images: item.images || [],
//       videos: item.videos || [],
//       gifs: item.gifs || [],
//       documents: item.documents || [],
//       stock: {
//         inStock: (item.inventory?.currentStock || 0) > 0,
//         quantity: item.inventory?.currentStock || 0,
//         unit: item.inventory?.unitOfMeasure || "pcs",
//       },
//       group: item.group,
//       subgroup: item.subgroup,
//       branch: branch
//         ? {
//             id: branch._id,
//             name: branch.branchName,
//             city: branch.address?.city || "",
//             state: branch.address?.state || "",
//             phone: branch.contact?.phone || "",
//             slug: branchSlug(branch),
//           }
//         : null,
//       related: related.map(toCard),
//       seo: { ...meta, jsonLd: productJsonLd(item, branch, origin + meta.canonicalPath, imageUrls) },
//     },
//   });
// });

// // POST /api/woven-essence/store/product/:id/view
// // Feeds Section 32 so the admin's "which product is most viewed" reporting has
// // real numbers instead of zeros. Fire-and-forget: never blocks the page.
// const recordView = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   if (!/^[a-f\d]{24}$/i.test(id)) {
//     res.status(400);
//     throw new Error("Invalid product id");
//   }

//   const seconds = Math.min(Math.max(parseInt(req.body?.seconds, 10) || 0, 0), 3600);

//   await Item.updateOne(
//     { _id: id, ...LIVE_ITEM },
//     {
//       $inc: {
//         "salesIntelligence.totalViews": 1,
//         "salesIntelligence.popularityScore": 1 + Math.floor(seconds / 30),
//       },
//     }
//   );

//   res.json({ success: true });
// });

// // POST /api/woven-essence/store/visit   { pageType, branch?, firstHit? }
// // Anonymous traffic counter. No IP, no user agent, no identifier of any kind is
// // stored — see models/Visit.js. Fire-and-forget from the browser.
// const recordVisit = asyncHandler(async (req, res) => {
//   const ALLOWED = ["home", "catalog", "product", "cart", "checkout", "account", "other"];
//   const pageType = ALLOWED.includes(req.body?.pageType) ? req.body.pageType : "other";
//   const branch = /^[a-f\d]{24}$/i.test(String(req.body?.branch || "")) ? req.body.branch : null;

//   await Visit.updateOne(
//     { day: Visit.dayKey(), branch, pageType },
//     { $inc: { views: 1, sessions: req.body?.firstHit ? 1 : 0 } },
//     { upsert: true }
//   );

//   res.status(202).json({ success: true });
// });

// module.exports = {
//   recordVisit,
//   listBranches,
//   catalog,
//   facets,
//   suggest,
//   productDetail,
//   recordView,
// };














const asyncHandler = require("express-async-handler");
const Branch = require("../models/Branch");
const Group = require("../models/Group");
const Subgroup = require("../models/Subgroup");
const Item = require("../models/Item");
const Visit = require("../models/Visit");
const {
  productSlug,
  branchSlug,
  itemCodeFromSlug,
  productMeta,
  catalogMeta,
  productJsonLd,
} = require("../utils/storeSeo");

/**
 * Public storefront API — no authentication, read-only.
 *
 * Visibility rule, applied to every query in this file: a saree reaches the
 * storefront only if it is active, published, not deleted, and its
 * visibility.onlineSaleEnabled is not false. The admin's draft/hold workflow is
 * therefore a real gate, not decoration.
 */

const LIVE_ITEM = {
  isDeleted: { $ne: true },
  status: "active",
  lifecycleStage: "published",
  "visibility.onlineSaleEnabled": { $ne: false },
};

const LIVE_BRANCH = {
  isDeleted: { $ne: true },
  status: "active",
};

/** Fields the catalog grid needs — deliberately narrow, these lists get long. */
const CARD_FIELDS = {
  "identity.productName": 1,
  "identity.displayName": 1,
  "identity.itemCode": 1,
  "identity.brand": 1,
  "identity.category": 1,
  "identity.featured": 1,
  "identity.newArrival": 1,
  "identity.bestSeller": 1,
  "identity.trending": 1,
  "saree.sareeType": 1,
  "saree.fabricType": 1,
  "saree.primaryFabric": 1,
  "saree.handloomStatus": 1,
  "saree.occasion": 1,
  "color.primaryColor": 1,
  "pricing.mrp": 1,
  "pricing.sellingPrice": 1,
  "pricing.discountPercent": 1,
  "pricing.currency": 1,
  "inventory.currentStock": 1,
  "reviews.averageRating": 1,
  "reviews.totalReviews": 1,
  "seo.slug": 1,
  images: 1,
  branch: 1,
  group: 1,
  subgroup: 1,
  createdAt: 1,
};

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Shapes a catalog card, including its SEO slug and a single hero image. */
function toCard(item) {
  const images = Array.isArray(item.images) ? item.images : [];
  const hero =
    images.find((i) => i.category === "Main Product Image") || images[0] || null;

  const mrp = item.pricing?.mrp;
  const selling = item.pricing?.sellingPrice;
  const discountPercent =
    mrp && selling && mrp > selling ? Math.round(((mrp - selling) / mrp) * 100) : null;

  // When several stores are being browsed the grid has to say which shop each
  // saree is in — otherwise a shopper can't tell why two similar pieces differ
  // in price, or which store an add-to-cart would pin them to.
  const branchDoc = item.branch && typeof item.branch === "object" ? item.branch : null;

  return {
    id: item._id,
    slug: item.seo?.slug || productSlug(item),
    itemCode: item.identity?.itemCode || "",
    branchId: branchDoc ? branchDoc._id : item.branch,
    branchName: branchDoc?.branchName || "",
    branchCity: branchDoc?.address?.city || "",
    name: item.identity?.displayName || item.identity?.productName || "Saree",
    brand: item.identity?.brand || "Woven Essence",
    sareeType: item.saree?.sareeType || "",
    fabric: item.saree?.fabricType || item.saree?.primaryFabric || "",
    handloom: item.saree?.handloomStatus === "handloom",
    occasion: item.saree?.occasion || "",
    colour: item.color?.primaryColor || "",
    mrp: mrp ?? null,
    sellingPrice: selling ?? null,
    discountPercent,
    currency: item.pricing?.currency || "INR",
    inStock: (item.inventory?.currentStock || 0) > 0,
    rating: item.reviews?.averageRating || 0,
    reviewCount: item.reviews?.totalReviews || 0,
    image: hero ? { url: hero.url, altText: hero.altText || item.identity?.productName } : null,
    imageCount: images.length,
    badges: [
      item.identity?.bestSeller && "Best seller",
      item.identity?.newArrival && "New arrival",
      item.identity?.trending && "Trending",
      item.identity?.featured && "Featured",
    ].filter(Boolean),
  };
}

// GET /api/woven-essence/store/branches
// The landing page's branch chooser. Only branches a shopper can actually buy from.
const listBranches = asyncHandler(async (req, res) => {
  const branches = await Branch.find(LIVE_BRANCH)
    .select("branchName branchCode address location contact")
    .sort("branchName")
    .lean();

  const withCounts = await Promise.all(
    branches.map(async (branch) => {
      const productCount = await Item.countDocuments({ ...LIVE_ITEM, branch: branch._id });
      return {
        id: branch._id,
        name: branch.branchName,
        code: branch.branchCode,
        slug: branchSlug(branch),
        city: branch.address?.city || "",
        state: branch.address?.state || "",
        pincode: branch.address?.pincode || "",
        phone: branch.contact?.phone || "",
        location: branch.location || null,
        productCount,
      };
    })
  );

  res.json({ success: true, data: withCounts });
});

/** Resolves a branch by id or SEO slug. */
/**
 * Resolves a `branch` query value that may name SEVERAL stores.
 *
 * Browsing across stores is useful — a shopper comparing Bengaluru and Chennai
 * stock shouldn't have to flip back and forth. Buying across stores is not:
 * an order is raised against one branch, with its own stock, pricing and
 * shipment, so the cart stays single-store (enforced in cartController). This
 * helper therefore only ever widens what is LISTED.
 *
 * Accepts "id", "slug", or "id,id,slug". Unknown entries are dropped rather
 * than failing the whole request, so one stale id in a shared link doesn't
 * blank the page.
 */
async function resolveBranches(param) {
  const parts = String(param || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 20); // a sane ceiling on how many stores one query can span

  if (parts.length === 0) return [];

  const resolved = await Promise.all(parts.map((p) => resolveBranch(p)));
  const seen = new Set();
  return resolved.filter((b) => {
    if (!b) return false;
    const key = String(b._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Mongo filter for a resolved branch list: exact match for one, $in for many. */
function branchFilterFor(branches) {
  if (branches.length === 0) return null;
  if (branches.length === 1) return branches[0]._id;
  return { $in: branches.map((b) => b._id) };
}

async function resolveBranch(idOrSlug) {
  if (!idOrSlug) return null;
  if (/^[a-f\d]{24}$/i.test(idOrSlug)) {
    return Branch.findOne({ _id: idOrSlug, ...LIVE_BRANCH }).lean();
  }
  const code = String(idOrSlug).match(/(tf-\d{4})$/i);
  if (code) {
    return Branch.findOne({ branchCode: code[1].toUpperCase(), ...LIVE_BRANCH }).lean();
  }
  return null;
}

// GET /api/woven-essence/store/catalog
// Query: branch, q, group, subgroup, colour, fabric, sareeType, occasion,
//        minPrice, maxPrice, sort, page, limit
const catalog = asyncHandler(async (req, res) => {
  const branches = await resolveBranches(req.query.branch);
  if (req.query.branch && branches.length === 0) {
    res.status(404);
    throw new Error("Branch not found or not open for online orders");
  }
  const branch = branches.length === 1 ? branches[0] : null;

  const filter = { ...LIVE_ITEM };
  const branchClause = branchFilterFor(branches);
  if (branchClause) filter.branch = branchClause;

  if (req.query.group) filter.group = req.query.group;
  if (req.query.subgroup) filter.subgroup = req.query.subgroup;

  // Attribute facets, matched case-insensitively so "Ruby Red" and "ruby red" agree.
  const facetMap = {
    colour: "color.primaryColor",
    secondaryColour: "color.secondaryColor",
    fabric: "saree.fabricType",
    material: "saree.fabricComposition",
    pattern: "saree.patternType",
    sareeType: "saree.sareeType",
    occasion: "saree.occasion",
    borderType: "saree.borderType",
    borderWidth: "saree.borderWidth",
  };
  Object.entries(facetMap).forEach(([param, path]) => {
    const value = req.query[param];
    if (value) {
      // Support multiple values separated by comma (OR logic)
      const values = String(value).split(",").map((v) => v.trim()).filter(Boolean);
      if (values.length === 1) {
        filter[path] = new RegExp(`^${escapeRegex(values[0])}$`, "i");
      } else if (values.length > 1) {
        filter[path] = { $in: values.map((v) => new RegExp(`^${escapeRegex(v)}$`, "i")) };
      }
    }
  });

  // Availability filter: in_stock or out_of_stock
  if (req.query.availability) {
    const availValues = String(req.query.availability).split(",").map((v) => v.trim()).filter(Boolean);
    const stockFilters = availValues.map((val) => {
      if (val === "in_stock") return { "inventory.currentStock": { $gt: 0 } };
      if (val === "out_of_stock") return { "inventory.currentStock": { $lte: 0 } };
      return null;
    }).filter(Boolean);
    if (stockFilters.length > 0) {
      filter.$or = stockFilters;
    }
  } else if (req.query.inStock === "true") {
    // Keep backward compatibility
    filter["inventory.currentStock"] = { $gt: 0 };
  }

  if (req.query.handloom === "true") filter["saree.handloomStatus"] = "handloom";

  const min = Number(req.query.minPrice);
  const max = Number(req.query.maxPrice);
  if (!Number.isNaN(min) || !Number.isNaN(max)) {
    filter["pricing.sellingPrice"] = {};
    if (!Number.isNaN(min)) filter["pricing.sellingPrice"].$gte = min;
    if (!Number.isNaN(max)) filter["pricing.sellingPrice"].$lte = max;
  }

  // Search across the fields a shopper would actually type.
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    filter.$or = [
      { "identity.productName": rx },
      { "identity.displayName": rx },
      { "identity.shortDescription": rx },
      { "identity.category": rx },
      { "identity.collectionName": rx },
      { "saree.sareeType": rx },
      { "saree.fabricType": rx },
      { "saree.weaveType": rx },
      { "saree.occasion": rx },
      { "color.primaryColor": rx },
      { "identity.itemCode": rx },
      { "seo.seoKeywords": rx },
    ];
  }

  const SORTS = {
    newest: "-createdAt",
    price_low: "pricing.sellingPrice",
    price_high: "-pricing.sellingPrice",
    popular: "-salesIntelligence.popularityScore -salesIntelligence.totalViews",
    rating: "-reviews.averageRating",
  };
  const sort = SORTS[req.query.sort] || "-identity.featured -createdAt";

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 24, 1), 60);

  const [total, docs] = await Promise.all([
    Item.countDocuments(filter),
    Item.find(filter)
      .select(CARD_FIELDS)
      .populate("branch", "branchName address.city")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: docs.map(toCard),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    seo: catalogMeta(branch, total, branches.length),
    branch: branch
      ? { id: branch._id, name: branch.branchName, city: branch.address?.city || "", slug: branchSlug(branch) }
      : null,
    // Every store the results span, so the UI can say "across 3 stores" and
    // attribute each card without a second request.
    branches: branches.map((b) => ({
      id: b._id,
      name: b.branchName,
      city: b.address?.city || "",
      slug: branchSlug(b),
    })),
  });
});

// GET /api/woven-essence/store/facets?branch=
// Filter options built from the live catalogue, so a filter never offers a value
// that returns nothing.
const facets = asyncHandler(async (req, res) => {
  const branches = await resolveBranches(req.query.branch);
  const match = { ...LIVE_ITEM };
  const branchClause = branchFilterFor(branches);
  if (branchClause) match.branch = branchClause;

  const [groups, subgroups, agg] = await Promise.all([
    Group.find({ isDeleted: { $ne: true }, status: "active", ...(branchClause ? { branch: branchClause } : {}) })
      .select("groupName groupCode")
      .sort("groupName")
      .lean(),
    Subgroup.find({ isDeleted: { $ne: true }, status: "active", ...(branchClause ? { branch: branchClause } : {}) })
      .select("subgroupName subgroupCode group")
      .sort("subgroupName")
      .lean(),
    Item.aggregate([
      { $match: match },
      {
        $facet: {
          availability: [
            {
              $group: {
                _id: { $cond: [{ $gt: ["$inventory.currentStock", 0] }, "in_stock", "out_of_stock"] },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          colours: [
            { $group: { _id: "$color.primaryColor", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          secondaryColours: [
            { $group: { _id: "$color.secondaryColor", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          fabrics: [
            { $group: { _id: "$saree.fabricType", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          materials: [
            { $group: { _id: "$saree.fabricComposition", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          patterns: [
            { $group: { _id: "$saree.patternType", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          sareeTypes: [
            { $group: { _id: "$saree.sareeType", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          occasions: [
            { $group: { _id: "$saree.occasion", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          borderTypes: [
            { $group: { _id: "$saree.borderType", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          borderWidths: [
            { $group: { _id: "$saree.borderWidth", count: { $sum: 1 } } },
            { $match: { _id: { $nin: [null, ""] } } },
            { $sort: { count: -1 } },
            { $limit: 50 },
          ],
          price: [
            {
              $group: {
                _id: null,
                min: { $min: "$pricing.sellingPrice" },
                max: { $max: "$pricing.sellingPrice" },
              },
            },
          ],
        },
      },
    ]),
  ]);

  const bucket = agg[0] || {};
  const shape = (rows) => (rows || []).map((r) => ({ value: r._id, count: r.count }));

  res.json({
    success: true,
    data: {
      groups: groups.map((g) => ({ id: g._id, name: g.groupName, code: g.groupCode })),
      subgroups: subgroups.map((s) => ({
        id: s._id,
        name: s.subgroupName,
        code: s.subgroupCode,
        group: s.group,
      })),
      availability: [
        { value: "in_stock", count: bucket.availability?.find((a) => a._id === "in_stock")?.count ?? 0 },
        { value: "out_of_stock", count: bucket.availability?.find((a) => a._id === "out_of_stock")?.count ?? 0 },
      ],
      colours: shape(bucket.colours),
      secondaryColours: shape(bucket.secondaryColours),
      fabrics: shape(bucket.fabrics),
      materials: shape(bucket.materials),
      patterns: shape(bucket.patterns),
      sareeTypes: shape(bucket.sareeTypes),
      occasions: shape(bucket.occasions),
      borderTypes: shape(bucket.borderTypes),
      borderWidths: shape(bucket.borderWidths),
      priceRange: {
        min: bucket.price?.[0]?.min ?? null,
        max: bucket.price?.[0]?.max ?? null,
      },
    },
  });
});

// GET /api/woven-essence/store/suggest?q=&branch=
// Powers the search box's live suggestions.
const suggest = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) return res.json({ success: true, data: { products: [], terms: [] } });

  const branches = await resolveBranches(req.query.branch);
  const rx = new RegExp(escapeRegex(q), "i");
  const match = { ...LIVE_ITEM };
  const branchClause = branchFilterFor(branches);
  if (branchClause) match.branch = branchClause;

  const products = await Item.find({
    ...match,
    $or: [
      { "identity.productName": rx },
      { "saree.sareeType": rx },
      { "saree.fabricType": rx },
      { "color.primaryColor": rx },
    ],
  })
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .limit(6)
    .lean();

  const terms = [
    ...new Set(
      products
        .flatMap((p) => [p.saree?.sareeType, p.saree?.fabricType, p.color?.primaryColor])
        .filter((t) => t && rx.test(t))
    ),
  ].slice(0, 6);

  res.json({ success: true, data: { products: products.map(toCard), terms } });
});

// GET /api/woven-essence/store/product/:slug
// Accepts the SEO slug, the raw item code, or the ObjectId.
const productDetail = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const itemCode = itemCodeFromSlug(slug);

  const or = [{ "seo.slug": slug }];
  if (itemCode) or.push({ "identity.itemCode": itemCode });
  if (/^[a-f\d]{24}$/i.test(slug)) or.push({ _id: slug });
  if (/^[A-Z0-9-]+$/i.test(slug)) or.push({ "identity.itemCode": slug.toUpperCase() });

  const item = await Item.findOne({ ...LIVE_ITEM, $or: or })
    .populate("group", "groupName groupCode")
    .populate("subgroup", "subgroupName subgroupCode")
    .lean();

  if (!item) {
    res.status(404);
    throw new Error("This saree is no longer available");
  }

  const branch = await Branch.findOne({ _id: item.branch, ...LIVE_BRANCH }).lean();

  // Related sarees: same subgroup first, then same fabric, never itself.
  const related = await Item.find({
    ...LIVE_ITEM,
    _id: { $ne: item._id },
    branch: item.branch,
    $or: [
      { subgroup: item.subgroup?._id || item.subgroup },
      { "saree.fabricType": item.saree?.fabricType || "__none__" },
      { "color.primaryColor": item.color?.primaryColor || "__none__" },
    ],
  })
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .limit(8)
    .lean();

  const origin = `${req.protocol}://${req.get("host")}`;
  const meta = productMeta(item, branch);
  const imageUrls = (item.images || []).map((i) => origin + i.url);

  res.json({
    success: true,
    data: {
      id: item._id,
      slug: item.seo?.slug || productSlug(item),
      // Full record minus the fields a shopper has no business seeing.
      identity: item.identity,
      saree: item.saree,
      color: item.color,
      size: item.size,
      pricing: {
        mrp: item.pricing?.mrp ?? null,
        sellingPrice: item.pricing?.sellingPrice ?? null,
        currency: item.pricing?.currency || "INR",
        discountPercent:
          item.pricing?.mrp && item.pricing?.sellingPrice && item.pricing.mrp > item.pricing.sellingPrice
            ? Math.round(((item.pricing.mrp - item.pricing.sellingPrice) / item.pricing.mrp) * 100)
            : null,
        taxInclusive: item.pricing?.taxInclusive ?? true,
      },
      tax: { gstRate: item.tax?.gstRate ?? null, hsnCode: item.tax?.hsnCode || "" },
      care: item.care,
      styling: item.styling,
      shipping: item.shipping,
      returns: item.returns,
      reviews: item.reviews,
      faqs: item.faqs || [],
      variants: item.variants || [],
      images: item.images || [],
      videos: item.videos || [],
      gifs: item.gifs || [],
      documents: item.documents || [],
      stock: {
        inStock: (item.inventory?.currentStock || 0) > 0,
        quantity: item.inventory?.currentStock || 0,
        unit: item.inventory?.unitOfMeasure || "pcs",
      },
      group: item.group,
      subgroup: item.subgroup,
      branch: branch
        ? {
            id: branch._id,
            name: branch.branchName,
            city: branch.address?.city || "",
            state: branch.address?.state || "",
            phone: branch.contact?.phone || "",
            slug: branchSlug(branch),
          }
        : null,
      related: related.map(toCard),
      seo: { ...meta, jsonLd: productJsonLd(item, branch, origin + meta.canonicalPath, imageUrls) },
    },
  });
});

// POST /api/woven-essence/store/product/:id/view
// Feeds Section 32 so the admin's "which product is most viewed" reporting has
// real numbers instead of zeros. Fire-and-forget: never blocks the page.
/**
 * GET /api/woven-essence/store/cards?ids=a,b,c
 *
 * Resolves item ids into catalogue cards, preserving the order asked for.
 *
 * Exists for the signed-out "recently viewed" rail, which keeps ids in the
 * browser and needs their current price, stock and photo. Public because it
 * reveals nothing a shopper couldn't already see on the catalogue — and it runs
 * through the same visibility gate, so an unpublished saree returns nothing even
 * if its id is known.
 */
const cardsByIds = asyncHandler(async (req, res) => {
  const ids = String(req.query.ids || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .slice(0, 24);

  if (ids.length === 0) return res.json({ success: true, data: [] });

  const items = await Item.find({ _id: { $in: ids }, ...LIVE_ITEM })
    .select(CARD_FIELDS)
    .populate("branch", "branchName address.city")
    .lean();

  // $in returns storage order, so re-sort into the order requested.
  const byId = new Map(items.map((i) => [String(i._id), i]));
  const cards = ids.map((id) => byId.get(id)).filter(Boolean).map(toCard);

  res.json({ success: true, data: cards });
});

const recordView = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) {
    res.status(400);
    throw new Error("Invalid product id");
  }

  const seconds = Math.min(Math.max(parseInt(req.body?.seconds, 10) || 0, 0), 3600);

  await Item.updateOne(
    { _id: id, ...LIVE_ITEM },
    {
      $inc: {
        "salesIntelligence.totalViews": 1,
        "salesIntelligence.popularityScore": 1 + Math.floor(seconds / 30),
      },
    }
  );

  res.json({ success: true });
});

// POST /api/woven-essence/store/visit   { pageType, branch?, firstHit? }
// Anonymous traffic counter. No IP, no user agent, no identifier of any kind is
// stored — see models/Visit.js. Fire-and-forget from the browser.
const recordVisit = asyncHandler(async (req, res) => {
  const ALLOWED = ["home", "catalog", "product", "cart", "checkout", "account", "other"];
  const pageType = ALLOWED.includes(req.body?.pageType) ? req.body.pageType : "other";
  const branch = /^[a-f\d]{24}$/i.test(String(req.body?.branch || "")) ? req.body.branch : null;

  await Visit.updateOne(
    { day: Visit.dayKey(), branch, pageType },
    { $inc: { views: 1, sessions: req.body?.firstHit ? 1 : 0 } },
    { upsert: true }
  );

  res.status(202).json({ success: true });
});

module.exports = {
  // Reused by recentlyViewedController so the card shape and the visibility
  // gate are defined once, not copied.
  CARD_FIELDS,
  toCard,
  LIVE_ITEM,
  recordVisit,
  listBranches,
  catalog,
  facets,
  suggest,
  productDetail,
  recordView,
  cardsByIds,
};