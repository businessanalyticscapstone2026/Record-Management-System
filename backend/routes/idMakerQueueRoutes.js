const express = require("express");

const router = express.Router();
const { authenticateToken, requireRoles } = require("../middleware/authMiddleware");

const {
  addToIdMakerQueue,
  getIdMakerQueue,
  updateIdMakerQueue,
  bulkUpdateIdMakerQueue,
} = require("../controllers/idMakerQueueController");
const {
  generateIdMakerAnalyticsInsights,
} = require("../controllers/idMakerAnalyticsController");


// GET ID MAKER QUEUE
router.get("/", authenticateToken, requireRoles("admin", "idmaker"), getIdMakerQueue);

// Generate validated descriptive text from aggregate statistics only.
router.post("/analytics-insights", authenticateToken, requireRoles("admin", "idmaker"), generateIdMakerAnalyticsInsights);


// ADD APPLICANT TO ID MAKER QUEUE
router.post("/", authenticateToken, requireRoles("admin", "staff"), addToIdMakerQueue);


// BULK UPDATE ID MAKER QUEUE
router.put("/bulk-status", authenticateToken, requireRoles("admin", "idmaker"), bulkUpdateIdMakerQueue);

// UPDATE ID MAKER QUEUE
router.put("/:applicationId", authenticateToken, requireRoles("admin", "idmaker"), updateIdMakerQueue);


module.exports = router;
