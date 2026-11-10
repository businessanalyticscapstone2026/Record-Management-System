const express = require("express");
const cors = require("cors");
require("dotenv").config();

const applicationRoutes = require("./routes/applicationRoutes");
const authRoutes = require("./routes/authRoutes");
const idMakerQueueRoutes = require("./routes/idMakerQueueRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const replacementRoutes = require("./routes/replacementRoutes");
const staffAnalyticsInsightsRoutes = require("./routes/staffAnalyticsInsightsRoutes");
const backupRoutes = require("./routes/backupRoutes");
const systemSettingsRoutes = require("./routes/systemSettingsRoutes");

const app = express();

app.disable("x-powered-by");

app.use(cors({
  origin: [
    "https://www.osca-management.techsite.live",
    "https://osca-management.techsite.live",
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501",
    "http://localhost:5506",
    "http://127.0.0.1:5506",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "5mb" }));

// Keep Render health checks lightweight: no database or external-service calls.
function sendHealthResponse(req, res) {
  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    status: "ok",
    service: "osca-record-management-backend",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

app.get("/", (req, res) => res.json({
  success: true,
  message: "Management System backend is working.",
}));
app.get("/health", sendHealthResponse);
app.get("/healthz", sendHealthResponse);

app.get("/api/test", (req, res) => res.json({
  success: true,
  message: "Record Management System backend is running.",
}));

// Log route duration only; never log request bodies or applicant data.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    if (req.path === "/health" || req.path === "/healthz") return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(`[http] ${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });
  next();
});

app.use("/api/applications", applicationRoutes);
app.use("/api/id-maker-queue", idMakerQueueRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/replacements", replacementRoutes);
app.use("/api/analytics-insights", staffAnalyticsInsightsRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/system-settings", systemSettingsRoutes);

app.use((error, req, res, next) => {
  console.error("[http] Unhandled request error:", error?.message || error);
  if (res.headersSent) return next(error);
  return res.status(error?.status || 500).json({
    success: false,
    message: error?.status && error.status < 500
      ? error.message
      : "The backend could not complete the request. Please try again.",
  });
});

// Export the Express app for Vercel Functions.
module.exports = app;

// Preserve the existing standalone server behavior for Render and local development.
if (require.main === module) {
  const PORT = Number(process.env.PORT) || 5000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.info(`Record Management backend listening on port ${PORT}`);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  function shutdown(signal) {
    console.info(`Received ${signal}; closing HTTP server.`);
    server.close((error) => {
      if (error) {
        console.error("Error while closing HTTP server:", error);
        process.exitCode = 1;
      }
    });
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
