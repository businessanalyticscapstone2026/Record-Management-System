const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

function normalizeRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (["admin", "administrator", "admin user"].includes(value)) return "admin";
  if (["staff", "osca staff", "frontline staff"].includes(value)) return "staff";
  if (["idmaker", "id maker", "osca id maker"].includes(value)) return "idmaker";
  return null;
}

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Re-check the account on every authenticated request so disabling or
    // soft-deleting an account immediately revokes already-issued JWT access.
    const { data: account, error } = await supabase
      .from("user_accounts")
      .select("id, account_status, deleted_at")
      .eq("id", decoded.id)
      .maybeSingle();

    if (error) {
      console.error("Authentication account-status lookup error:", error);
      return res.status(503).json({
        success: false,
        message: "Unable to verify account access. Please try again.",
      });
    }

    if (!account || account.deleted_at || account.account_status !== "Active") {
      return res.status(401).json({
        success: false,
        message: "This account is inactive or has been deleted. Please contact an administrator.",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
}

function requireRoles(...allowedRoles) {
  const allowed = new Set(allowedRoles.map(normalizeRole).filter(Boolean));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const role = normalizeRole(req.user.role);
    if (!role || !allowed.has(role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

function requireAdmin(req, res, next) {
  return requireRoles("admin")(req, res, next);
}

module.exports = {
  authenticateToken,
  requireAdmin,
  requireRoles,
  normalizeRole,
};
