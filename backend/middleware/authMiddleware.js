const jwt = require("jsonwebtoken");

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

function authenticateToken(req, res, next) {
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
