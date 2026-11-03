const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "role-authorization-tests-only";

const {
  authenticateToken,
  requireRoles,
  requireAdmin,
  normalizeRole,
} = require("../middleware/authMiddleware");

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("normalizes supported role variants", () => {
  assert.equal(normalizeRole("Admin"), "admin");
  assert.equal(normalizeRole("Administrator"), "admin");
  assert.equal(normalizeRole("OSCA Staff"), "staff");
  assert.equal(normalizeRole("Frontline Staff"), "staff");
  assert.equal(normalizeRole("ID Maker"), "idmaker");
  assert.equal(normalizeRole("OSCA_ID_MAKER"), "idmaker");
  assert.equal(normalizeRole("unknown"), null);
});

test("authenticateToken rejects a missing bearer token with 401", () => {
  const req = { headers: {} };
  const res = mockResponse();
  let called = false;

  authenticateToken(req, res, () => { called = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(called, false);
});

test("authenticateToken accepts a valid signed bearer token", () => {
  const token = jwt.sign({ id: 1, role: "Staff" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  let called = false;

  authenticateToken(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(req.user.role, "Staff");
});

test("authenticateToken rejects an expired token with 401", () => {
  const token = jwt.sign(
    { id: 1, role: "Staff" },
    process.env.JWT_SECRET,
    { expiresIn: -1 }
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockResponse();
  let called = false;

  authenticateToken(req, res, () => { called = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test("requireRoles returns 401 when authentication is missing", () => {
  const req = {};
  const res = mockResponse();
  let called = false;

  requireRoles("admin")(req, res, () => { called = true; });

  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
});

test("requireRoles permits only the allowed normalized role", () => {
  const req = { user: { role: "OSCA Staff" } };
  const res = mockResponse();
  let called = false;

  requireRoles("admin", "staff")(req, res, () => { called = true; });

  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});

test("requireRoles returns 403 for an authenticated but disallowed role", () => {
  const req = { user: { role: "ID Maker" } };
  const res = mockResponse();
  let called = false;

  requireRoles("admin", "staff")(req, res, () => { called = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(called, false);
});

test("requireAdmin permits admin variants and rejects staff", () => {
  const adminReq = { user: { role: "Administrator" } };
  const adminRes = mockResponse();
  let adminNext = false;
  requireAdmin(adminReq, adminRes, () => { adminNext = true; });
  assert.equal(adminNext, true);

  const staffReq = { user: { role: "Staff" } };
  const staffRes = mockResponse();
  let staffNext = false;
  requireAdmin(staffReq, staffRes, () => { staffNext = true; });
  assert.equal(staffRes.statusCode, 403);
  assert.equal(staffNext, false);
});
