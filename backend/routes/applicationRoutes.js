const express = require("express");
const router = express.Router();

const { authenticateToken, requireRoles } = require("../middleware/authMiddleware");

const {
  getApplications,
  importApplicantRecords,
  importApplicantDocuments,
  getApplicationById,
  getIssuanceDetails,
  saveApplicationValidation,
  updateApplicationStatus,
  updateApplicationRemarks,
  updateMembershipStatus,
  updateDocumentAuthentication,
  approveAllDocumentAuthentications,
  downloadIssuanceDocument,
} = require("../controllers/applicationController");

router.get("/", authenticateToken, requireRoles("admin", "staff"), getApplications);
router.post("/import", authenticateToken, requireRoles("admin", "staff"), importApplicantRecords);
router.post(
  "/import/documents",
  authenticateToken,
  requireRoles("admin", "staff"),
  express.raw({ type: ["application/zip", "application/x-zip-compressed"], limit: "80mb" }),
  importApplicantDocuments
);

router.get("/:applicationId/issuance-details", authenticateToken, requireRoles("admin", "staff", "idmaker"), getIssuanceDetails);

router.get("/:applicationId", authenticateToken, requireRoles("admin", "staff"), getApplicationById);

router.post("/:applicationId/issuance-document", authenticateToken, requireRoles("admin", "staff", "idmaker"), downloadIssuanceDocument);

router.put("/:applicationId/status", authenticateToken, requireRoles("admin", "staff", "idmaker"), updateApplicationStatus);
router.put("/:applicationId/remarks", authenticateToken, requireRoles("admin", "staff"), updateApplicationRemarks);

router.put("/:applicationId/membership-status", authenticateToken, requireRoles("admin", "staff"), updateMembershipStatus);

router.put(
  "/:applicationId/documents/:documentType/authentication", authenticateToken, requireRoles("admin", "staff"), updateDocumentAuthentication);

router.put("/:applicationId/documents/approve-all", authenticateToken, requireRoles("admin", "staff"), approveAllDocumentAuthentications);

router.put("/:applicationId/validation", authenticateToken, requireRoles("admin", "staff"), saveApplicationValidation);

module.exports = router;
