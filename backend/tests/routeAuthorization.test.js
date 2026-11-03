const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const route = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "routes", name), "utf8");

function assertRouteHasMiddleware(source, method, routePath, middleware) {
  const methodMarker = `router.${method}(`;
  let searchFrom = 0;
  let declarationStart = -1;

  while ((searchFrom = source.indexOf(methodMarker, searchFrom)) !== -1) {
    const doubleQuotedPath = source.indexOf(`"${routePath}"`, searchFrom + methodMarker.length);
    const singleQuotedPath = source.indexOf(`'${routePath}'`, searchFrom + methodMarker.length);
    const candidates = [doubleQuotedPath, singleQuotedPath].filter(index => index !== -1);
    const pathIndex = candidates.length ? Math.min(...candidates) : -1;

    if (pathIndex !== -1) {
      const close = source.indexOf(");", pathIndex);
      if (close !== -1) {
        const declaration = source.slice(searchFrom, close);
        if (declaration.includes(middleware)) return;
        declarationStart = searchFrom;
      }
    }
    searchFrom += methodMarker.length;
  }

  assert.fail(
    declarationStart === -1
      ? `${method.toUpperCase()} ${routePath} route with ${middleware} was not found`
      : `${method.toUpperCase()} ${routePath} route is missing ${middleware}`
  );
}

test("application data reads require authenticated admin or staff", () => {
  const source = route("applicationRoutes.js");
  assertRouteHasMiddleware(source, "get", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/", 'requireRoles("admin", "staff")');
  assertRouteHasMiddleware(source, "get", "/:applicationId", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/:applicationId", 'requireRoles("admin", "staff")');
});

test("staff can only read limited ID Maker queue identifiers", () => {
  const source = route("idMakerQueueRoutes.js");
  assertRouteHasMiddleware(source, "get", "/application-ids", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/application-ids", 'requireRoles("admin", "staff")');
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

test("audit log viewing and imports are administrator only while Staff can record exports", () => {
  const source = route("auditLogRoutes.js");

  assertRouteHasMiddleware(source, "get", "/", "authenticateToken");
  assertRouteHasMiddleware(source, "get", "/", "requireAdmin");

  assertRouteHasMiddleware(source, "post", "/exports", "authenticateToken");
  assertRouteHasMiddleware(source, "post", "/exports", 'requireRoles("admin", "staff")');

  assertRouteHasMiddleware(source, "post", "/imports", "authenticateToken");
  assertRouteHasMiddleware(source, "post", "/imports", "requireAdmin");
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
