require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const branchRoutes = require("./routes/branchRoutes");
const groupRoutes = require("./routes/groupRoutes");
const subgroupRoutes = require("./routes/subgroupRoutes");
const productGroupRoutes = require("./routes/productGroupRoutes");
const erpRoutes = require("./routes/erpRoutes");
const erpItemRoutes = require("./routes/erpItemRoutes");
const itemRoutes = require("./routes/itemRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const storeRoutes = require("./routes/storeRoutes");
const accountRoutes = require("./routes/accountRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const checkoutRoutes = require("./routes/checkoutRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");
const {
  webhook: shiprocketWebhook,
} = require("./controllers/shipmentController");
const groupShoppingRoutes = require("./routes/groupShoppingRoutes");

const couponRoutes = require("./routes/couponRoutes"); // ← ADD THIS LINE

const app = express();
app.disable("etag");
const API = "/api/woven-essence";

/* ─── CORS: whitelist the ERP + any external frontends via .env ─────────── */
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // allow non-browser tools (curl/Postman) with no Origin header
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Locally-stored product media (no Base64, no cloud storage)
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Product photos and the certificates shown on a product page are deliberately
// public — the storefront links to them. What's hardened is how they're served.
const INLINE_SAFE = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".pdf",
  ".mp4",
  ".webm",
]);

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    dotfiles: "deny",
    index: false,
    redirect: false,
    setHeaders(res, filePath) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; img-src 'self'; sandbox",
      );
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

      const ext = path.extname(filePath).toLowerCase();
      if (!INLINE_SAFE.has(ext)) {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(filePath)}"`,
        );
      }
    },
  }),
);

app.get(`${API}/health`, (req, res) => {
  res.json({
    success: true,
    service: "woven-essence-backend",
    time: new Date().toISOString(),
  });
});

/* ─── API namespace: never collides with the existing ERP's routes ─────── */
app.use(`${API}/auth`, authRoutes);
app.use(`${API}/branches`, branchRoutes);
app.use(`${API}/groups`, groupRoutes);
app.use(`${API}/subgroups`, subgroupRoutes);
app.use(`${API}/product-groups`, productGroupRoutes); // ERP-owned Product Group master
app.use(`${API}/erp`, erpRoutes); // ERP-owned scope selectors (branch list)
app.use(`${API}/product-items`, erpItemRoutes); // ERP-owned Item master
app.use(`${API}/items`, itemRoutes);
app.use(`${API}/uploads`, uploadRoutes);
app.use(`${API}/store`, storeRoutes); // public storefront, no auth
app.use(`${API}/account`, accountRoutes); // customer accounts (separate from /auth)
app.use(`${API}/cart`, cartRoutes);
app.use(`${API}/wishlist`, wishlistRoutes);
app.use(`${API}/checkout`, checkoutRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/admin`, adminRoutes);
app.use(`${API}/admin/shipments`, shipmentRoutes); // ← add
app.post(`${API}/webhooks/shiprocket`, shiprocketWebhook);
app.use(`${API}/group`, groupShoppingRoutes);
app.use(`${API}/coupons`, couponRoutes); // ← ADD THIS LINE
// 404 + error handling apply to the API only. Registering them globally would
// swallow every SPA route below and return JSON where a page belongs.
app.use(API, notFound);
app.use(errorHandler);

/* ═══════════════════════════════════════════════════════════════════════
   SINGLE-PORT HOSTING

   One React app in frontend/, served from this one process, on one port:

     /        → customer shop
     /admin   → admin panel (staff)
     /login   → sign-in chooser (customer or admin)
     /api/…   → this API
     /uploads → product media

   In development the Vite dev server still runs on :5173 for hot reload, but
   this process proxies to it, so you only ever open 
   ══════════════════════════════════════════════════════════════════════ */

const CLIENT_DIST = path.resolve(__dirname, "..", "..", "frontend", "dist");

const isProd = process.env.NODE_ENV === "production";
const hasBuild = fs.existsSync(path.join(CLIENT_DIST, "index.html"));

if (isProd || hasBuild) {
  // ── serve the built app ──
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: /saree/xyz and /admin/items are client routes, not files.
  //
  // Asset paths are excluded on purpose. A missing upload used to fall through
  // to here and answer with index.html and a 200, so an <img> pointed at a file
  // that isn't on this box received HTML instead of an error — the browser drew
  // a broken-image icon and onError never fired, so the "No image" placeholder
  // never got its chance. These paths 404 now, which is the truth.
  const ASSET_PREFIXES = ["/uploads/", "/api/"];
  app.get("*", (req, res, next) => {
    if (ASSET_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
  console.log(
    "[serve] frontend build -> /  (shop)  and  /admin  (admin panel)",
  );
} else {
  // ── development: proxy to the Vite dev server so hot reload keeps working ──
  let createProxyMiddleware;
  try {
    ({ createProxyMiddleware } = require("http-proxy-middleware"));
  } catch {
    console.warn(
      "\n[serve] http-proxy-middleware is not installed, so single-port dev is off.\n" +
        "        Run:  npm install http-proxy-middleware --save-dev\n" +
        "        Until then, open the app directly on http://localhost:5173\n",
    );
  }

  if (createProxyMiddleware) {
    const CLIENT_DEV = process.env.CLIENT_DEV_URL || "http://localhost:5173";
    app.use(
      "/",
      createProxyMiddleware({
        target: CLIENT_DEV,
        changeOrigin: true,
        ws: true, // Vite's hot reload runs over a websocket
      }),
    );
    console.log(`[serve] dev proxy      -> / => ${CLIENT_DEV}`);
  }
}

const PORT = process.env.PORT || 5001;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Woven Essence running on http://localhost:${PORT}`);
    console.log(`  Shop         http://localhost:${PORT}/`);
    console.log(`  Admin panel  http://localhost:${PORT}/admin`);
    console.log(`  Sign in      http://localhost:${PORT}/login`);
    console.log(`  API          http://localhost:${PORT}${API}\n`);
  });
});

module.exports = app;
