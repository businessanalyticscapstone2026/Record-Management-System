const express = require("express");
const router = express.Router();
const { generateStaffAnalyticsInsights } = require("../controllers/staffAnalyticsInsightsController");
const { authenticateToken, requireRoles } = require("../middleware/authMiddleware");
router.post("/", authenticateToken, requireRoles("admin", "staff"), generateStaffAnalyticsInsights);
module.exports = router;
