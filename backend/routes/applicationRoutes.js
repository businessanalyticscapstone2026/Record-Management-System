const express = require("express");
const router = express.Router();

const { authenticateToken, requireRoles } = require("../middleware/authMiddleware");

const {
  getApplications,
  getApplicationById,
  saveApplicationValidation,
  updateApplicationStatus,
  updateMembershipStatus,
  updateDocumentAuthentication,
  approveAllDocumentAuthentications,
  downloadIssuanceDocument,
} = require("../controllers/applicationController");

router.get("/", authenticateToken, requireRoles("admin", "staff"), getApplications);

router.get("/:applicationId", authenticateToken, requireRoles("admin", "staff"), getApplicationById);

router.post("/:applicationId/issuance-document", authenticateToken, requireRoles("admin", "staff"), downloadIssuanceDocument);

router.put("/:applicationId/status", authenticateToken, requireRoles("admin", "staff", "idmaker"), updateApplicationStatus);

router.put("/:applicationId/membership-status", authenticateToken, requireRoles("admin", "staff"), updateMembershipStatus);

router.put(
  "/:applicationId/documents/:documentType/authentication", authenticateToken, requireRoles("admin", "staff"), updateDocumentAuthentication);

router.put("/:applicationId/documents/approve-all", authenticateToken, requireRoles("admin", "staff"), approveAllDocumentAuthentications);

router.put("/:applicationId/validation", authenticateToken, requireRoles("admin", "staff"), saveApplicationValidation);

module.exports = router;
