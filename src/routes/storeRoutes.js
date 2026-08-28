
// // const express = require("express");
// // const ctrl = require("../controllers/storeController");

// // /**
// //  * Public storefront routes — deliberately NOT behind `protect`.
// //  *
// //  * A shopper browsing the catalogue has no account yet; login is only required
// //  * later, at add-to-cart. Everything here is read-only except recordView, which
// //  * increments a view counter and cannot leak or alter product data.
// //  */
// // const router = express.Router();

// // router.get("/branches", ctrl.listBranches);
// // router.get("/catalog", ctrl.catalog);
// // router.get("/facets", ctrl.facets);
// // router.get("/suggest", ctrl.suggest);
// // router.get("/product/:slug", ctrl.productDetail);
// // router.post("/product/:id/view", ctrl.recordView);
// // router.post("/visit", ctrl.recordVisit);

// // module.exports = router;






// const express = require("express");
// const ctrl = require("../controllers/storeController");

// /**
//  * Public storefront routes — deliberately NOT behind `protect`.
//  *
//  * A shopper browsing the catalogue has no account yet; login is only required
//  * later, at add-to-cart. Everything here is read-only except recordView, which
//  * increments a view counter and cannot leak or alter product data.
//  */
// const router = express.Router();

// router.get("/branches", ctrl.listBranches);
// router.get("/catalog", ctrl.catalog);
// router.get("/facets", ctrl.facets);
// router.get("/suggest", ctrl.suggest);
// router.get("/product/:slug", ctrl.productDetail);
// router.post("/product/:id/view", ctrl.recordView);
// router.post("/visit", ctrl.recordVisit);
// router.get("/cards", ctrl.cardsByIds);

// module.exports = router;








const express = require("express");
const ctrl = require("../controllers/storeController");
const chatCtrl = require("../controllers/chatController");
const { optionalCustomer } = require("../middleware/customerAuth");

/**
 * Public storefront routes — deliberately NOT behind `protect`.
 *
 * A shopper browsing the catalogue has no account yet; login is only required
 * later, at add-to-cart. Everything here is read-only except recordView, which
 * increments a view counter and cannot leak or alter product data.
 */
const router = express.Router();

router.get("/branches", ctrl.listBranches);
router.get("/catalog", ctrl.catalog);
router.get("/facets", ctrl.facets);
router.get("/suggest", ctrl.suggest);
router.get("/product/:slug", ctrl.productDetail);
router.post("/product/:id/view", ctrl.recordView);
router.post("/visit", ctrl.recordVisit);
router.get("/cards", ctrl.cardsByIds);

// Shop assistant. optionalCustomer so a signed-in shopper gets their own order
// status, while an anonymous visitor still gets catalogue answers.
router.get("/chat/greeting", optionalCustomer, chatCtrl.chatGreeting);
router.post("/chat", optionalCustomer, chatCtrl.chat);
router.post("/chat/menu", optionalCustomer, chatCtrl.chatMenu);

module.exports = router;