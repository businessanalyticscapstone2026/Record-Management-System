const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const route = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "routes", name), "utf8");

function assertRouteHasMiddleware(source, method, routePath, middleware) {
  const routeStartPattern = new RegExp(
    `router\\\\.${method}\\\\(\\\\s*["']${routePath.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["']`
  );
  const match = routeStartPattern.exec(source);
  assert.ok(match, `${method.toUpperCase()} ${routePath} route must exist`);

  const close = source.indexOf(");", match.index);
  assert.notEqual(close, -1, `${method.toUpperCase()} ${routePath} route must close`);

  const declaration = source.slice(match.index, close);
  assert.ok(declaration.includes(middleware), `${method.toUpperCase()} ${routePath} must use ${middleware}`);
}

test("application data reads require authenticated admin or staff", () => {
  const source = route("applicationRoutes.js");
  assertRouteHasMiddleware(source, "get", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/", 'requireRoles("admin", "staff")');
  assertRouteHasMiddleware(source, "get", "/:applicationId", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/:applicationId", 'requireRoles("admin", "staff")');
});

test("ID Maker queue reads and updates are role restricted", () => {
  const source = route("idMakerQueueRoutes.js");
  assertRouteHasMiddleware(source, "get", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/", 'requireRoles("admin", "idmaker")');
  assertRouteHasMiddleware(source, "put", "/:applicationId", "authenticateToken");
  assertRouteHasMiddleware(source, "put", "/:applicationId", 'requireRoles("admin", "idmaker")');
});

test("replacement request routes require authenticated permitted roles", () => {
  const source = route("replacementRoutes.js");
  for (const routePath of ["/", "/:id"]) {
    assertRouteHasMiddleware(source, "get", routePath, "authenticateToken");
    assertRouteHasMiddleware(source, "get", routePath, 'requireRoles("admin", "staff", "idmaker")');
  }
});

test("audit log routes are administrator only", () => {
  const source = route("auditLogRoutes.js");
  for (const routePath of ["/", "/exports", "/imports"]) {
    const method = routePath === "/" ? "get" : "post";
    assertRouteHasMiddleware(source, method, routePath, "authenticateToken");
    assertRouteHasMiddleware(source, method, routePath, "requireAdmin");
  }
});

test("backup routes apply administrator authorization router-wide", () => {
  const source = route("backupRoutes.js");
  assert.match(source, /router\.use\(authenticateToken,\s*requireAdmin\)/);
});

test("system settings keep only the public settings endpoint public", () => {
  const source = route("systemSettingsRoutes.js");
  assertRouteHasMiddleware(source, "get", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/", "requireAdmin");
  assert.match(source, /router\.get\(["']\/public["'],\s*async/);
});

test("staff analytics insights require authenticated admin or staff", () => {
  const source = route("staffAnalyticsInsightsRoutes.js");
  assertRouteHasMiddleware(source, "post", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "post", "/", 'requireRoles("admin", "staff")');
});
