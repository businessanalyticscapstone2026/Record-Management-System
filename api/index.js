// Vercel serverless entry point for the Record Management System.
// Load the Express application lazily so a startup exception is logged by the
// function instead of being reported only as FUNCTION_INVOCATION_FAILED.
let expressApp;

function getExpressApp() {
  if (!expressApp) {
    try {
      expressApp = require("../backend/server");
      if (typeof expressApp !== "function") {
        throw new TypeError("backend/server did not export an Express request handler.");
      }
    } catch (error) {
      console.error("[Vercel API bootstrap] Unable to load backend/server:", error?.stack || error);
      throw error;
    }
  }
  return expressApp;
}

module.exports = function handler(req, res) {
  try {
    return getExpressApp()(req, res);
  } catch (error) {
    console.error("[Vercel API handler] Request failed before Express could handle it:", error?.stack || error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({
        success: false,
        message: "The backend could not start. Check the Vercel function runtime logs.",
      }));
    }
  }
};
