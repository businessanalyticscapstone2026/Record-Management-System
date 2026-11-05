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

app.use(cors({
  origin: [
    'https://record-management-system-black.vercel.app',
    // Allow local development servers regardless of the port they choose.
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5501',
    'http://localhost:5506',
    'http://127.0.0.1:5506',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '5mb' }));

app.use("/api/applications", applicationRoutes);
app.use("/api/id-maker-queue", idMakerQueueRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/audit-logs", auditLogRoutes);
app.use("/api/replacements", replacementRoutes);
app.use("/api/analytics-insights", staffAnalyticsInsightsRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/system-settings", systemSettingsRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Management System backend is working."
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Record Management System backend is running."
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
