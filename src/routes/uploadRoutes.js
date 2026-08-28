// const express = require("express");
// const { protect } = require("../middleware/auth");
// const { buildUploader } = require("../middleware/upload");
// const ctrl = require("../controllers/uploadController");

// const router = express.Router();
// router.use(protect);

// router.post("/image", buildUploader("image").single("file"), ctrl.uploadImage);
// router.post("/video", buildUploader("video").single("file"), ctrl.uploadVideo);
// router.post("/gif", buildUploader("gif").single("file"), ctrl.uploadGif);
// router.post("/document", buildUploader("document").single("file"), ctrl.uploadDocument);

// module.exports = router;



const express = require("express");
const { protect } = require("../middleware/auth");
const { scopeToAssignedBranch } = require("../middleware/branchScope");
const { buildUploader } = require("../middleware/upload");
const ctrl = require("../controllers/uploadController");

const router = express.Router();
router.use(protect);
// Pins branch_admin and staff to their own branch; super_admin unaffected.
router.use(scopeToAssignedBranch);

router.post("/image", buildUploader("image").single("file"), ctrl.uploadImage);
router.post("/video", buildUploader("video").single("file"), ctrl.uploadVideo);
router.post("/gif", buildUploader("gif").single("file"), ctrl.uploadGif);
router.post("/document", buildUploader("document").single("file"), ctrl.uploadDocument);

module.exports = router;