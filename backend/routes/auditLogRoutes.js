const express = require("express");

const {
  getAuditLogs,
  recordExportAudit,
  recordImportAudit,
} = require("../controllers/auditLogController");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  requireAdmin,
  getAuditLogs
);

router.post(
  "/exports",
  authenticateToken,
  requireAdmin,
  recordExportAudit
);

router.post(
  "/imports",
  authenticateToken,
  requireAdmin,
  recordImportAudit
);

module.exports = router;