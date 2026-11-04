const supabase = require("../config/supabase");

async function createAuditLog({
  userId = null,
  username = null,
  role = null,
  action,
  entityType = null,
  entityId = null,
  details = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        username,
        role,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (error) {
      console.error("Audit log insert error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Audit log exception:", error);
    return false;
  }
}

async function createAuditLogFromRequest(req, {
  action,
  entityType = null,
  entityId = null,
  details = null,
  username = null,
  role = null,
  userId = null,
} = {}) {
  const actor = req.user || {};
  return createAuditLog({
    userId: userId ?? actor.id ?? null,
    username: username ?? actor.username ?? actor.displayName ?? null,
    role: role ?? actor.role ?? null,
    action,
    entityType,
    entityId: entityId == null ? null : String(entityId),
    details,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
}

async function getAuditLogs(req, res) {
  try {
    // Supabase applies a maximum row count per request, so the UI retrieves
    // the full history through consecutive pages instead of truncating at 500.
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 1000, 1), 1000);
    const requestedOffset = Number.parseInt(req.query.offset, 10);
    const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Get audit logs error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load audit logs.",
      });
    }

    const page = data || [];
    const userIds = [...new Set(page
      .map((log) => log.user_id)
      .filter((id) => id !== null && id !== undefined))];

    let usersById = new Map();
    if (userIds.length) {
      const { data: users, error: usersError } = await supabase
        .from("user_accounts")
        .select("id, full_name, username, email")
        .in("id", userIds);

      if (usersError) {
        console.warn("Unable to enrich audit logs with account names:", usersError);
      } else {
        usersById = new Map((users || []).map((user) => [String(user.id), user]));
      }
    }

    const logs = page.map((log) => {
      const account = log.user_id == null
        ? null
        : usersById.get(String(log.user_id));

      return {
        ...log,
        username: log.username || account?.username || null,
        full_name: account?.full_name || null,
        email: account?.email || null,
      };
    });

    return res.json({
      success: true,
      logs,
      pagination: {
        limit,
        offset,
        nextOffset: offset + logs.length,
        hasMore: logs.length === limit,
      },
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while loading audit logs.",
    });
  }
}


async function recordDataActivity(req, res, forcedAction = null) {
  try {
    const actorRole = String(req.user?.role || "").trim().toLowerCase();
    if (!["admin", "administrator", "staff", "osca staff"].includes(actorRole)) {
      return res.status(403).json({ success: false, message: "Only authorized Staff and Admin accounts can record data activities." });
    }
    const action = forcedAction || String(req.body?.action || "DATA_EXPORTED").trim().toUpperCase();
    const isExport = action === "DATA_EXPORTED";
    const isImport = action === "DATA_IMPORTED";
    const report = String(req.body?.report || "").trim().slice(0, 120);
    const format = String(req.body?.format || "CSV").trim().toUpperCase().slice(0, 12);
    const recordCount = Number(req.body?.recordCount);
    if ((!isExport && !isImport) || !report || !["CSV", "JSON", "PDF", "XLSX"].includes(format) ||
        !Number.isInteger(recordCount) || recordCount < 0) {
      return res.status(400).json({ success: false, message: "A valid activity type, report name, format, and record count are required." });
    }
    const saved = await createAuditLogFromRequest(req, {
      action,
      entityType: isExport ? "export" : "import",
      details: `${isExport ? "Exported" : "Imported"} ${report} as ${format} (${recordCount.toLocaleString()} records).`,
    });
    if (!saved) {
      return res.status(500).json({ success: false, message: "The activity could not be saved to the audit log." });
    }
    return res.status(201).json({ success: true, message: `${isExport ? "Export" : "Import"} activity recorded.` });
  } catch (error) {
    console.error("Record data activity error:", error);
    return res.status(500).json({ success: false, message: "Unable to record the data activity." });
  }
}

async function recordExportAudit(req, res) {
  return recordDataActivity(req, res, "DATA_EXPORTED");
}

async function recordImportAudit(req, res) {
  return recordDataActivity(req, res, "DATA_IMPORTED");
}

module.exports = {
  createAuditLog,
  createAuditLogFromRequest,
  recordExportAudit,
  recordImportAudit,
  recordDataActivity,
  getAuditLogs,
};
