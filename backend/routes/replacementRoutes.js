
const express = require("express");
const router = express.Router();
const { authenticateToken, requireRoles } = require("../middleware/authMiddleware");

const {
  getReplacementRequests,
  getReplacementRequestById,
  decideReplacementRequest,
} = require("../controllers/replacementController");

router.get("/", authenticateToken, requireRoles("admin", "staff", "idmaker"), getReplacementRequests);
router.get("/:id", authenticateToken, requireRoles("admin", "staff", "idmaker"), getReplacementRequestById);
router.put("/:id/decision", authenticateToken, requireRoles("admin", "staff", "idmaker"), decideReplacementRequest);

module.exports = router;
