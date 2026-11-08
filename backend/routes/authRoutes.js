const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const crypto = require("crypto");

const {
  createAuditLog,
} = require("../controllers/auditLogController");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();


/* =========================================================
   PASSWORD VALIDATION
   ========================================================= */

function normalizeDatabaseRole(role) {
  const value = String(role || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  if (["admin", "administrator"].includes(value)) return "admin";
  if (["staff", "osca staff"].includes(value)) return "staff";
  if (["idmaker", "id maker", "osca id maker"].includes(value)) return "idmaker";

  return null;
}

function isStrongPassword(password) {
  const value = String(password || "");

  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}


/* =========================================================
   LOGIN
   POST /api/auth/login
   ========================================================= */

router.post("/login", async (req, res) => {
  try {
    // Accept either the account username or registered email address.
    // Keep the legacy "username" request field supported for existing clients.
    const loginIdentifier = String(
      req.body.identifier ?? req.body.username ?? ""
    ).trim();
    const password = String(req.body.password || "");

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Username or email and password are required.",
      });
    }

    const isEmailLogin = loginIdentifier.includes("@");
    const lookupColumn = isEmailLogin ? "email" : "username";

    let { data: user, error } = await supabase
      .from("user_accounts")
      .select(
        "id, username, full_name, password_hash, role, email, account_status, approval_status"
      )
      [isEmailLogin ? "ilike" : "ilike"](lookupColumn, loginIdentifier)
      .maybeSingle();

    // Compatibility fallback while the approval migration has not yet
    // been applied to the production Supabase database. Existing accounts
    // can still log in; public registration requires migration 003.
    const approvalColumnMissing = error && (
      error.code === "42703" ||
      error.code === "PGRST204" ||
      /approval_status.*(column|schema cache)|column.*approval_status/i.test(error.message || "")
    );

    if (approvalColumnMissing) {
      console.warn("approval_status column is missing; using legacy login lookup until migration 003 is applied.");
      const fallback = await supabase
        .from("user_accounts")
        .select("id, username, full_name, password_hash, role, email, account_status")
        .ilike(lookupColumn, loginIdentifier)
        .maybeSingle();
      user = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("Supabase login error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to process login. Please check the account database migration and backend logs.",
      });
    }

    if (!user) {
      await createAuditLog({
        username: user?.username || loginIdentifier,
        action: "LOGIN_FAILED",
        entityType: "USER",
        details: "Failed login attempt for unknown username or email.",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid username/email or password.",
      });
    }

    /* -----------------------------------------
       Block accounts awaiting administrator approval.
       Missing approval_status means an existing account;
       those accounts remain approved for backward compatibility.
       ----------------------------------------- */
    const approvalStatus = String(user.approval_status || "Approved").trim();
    if (approvalStatus !== "Approved") {
      await createAuditLog({
        userId: user.id,
        username: user.username,
        role: user.role,
        action: "LOGIN_BLOCKED",
        entityType: "USER",
        entityId: String(user.id),
        details: `Login blocked because account approval status is ${approvalStatus}.`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      return res.status(403).json({
        success: false,
        code: approvalStatus === "Rejected" ? "ACCOUNT_REJECTED" : "ACCOUNT_PENDING",
        message: approvalStatus === "Rejected"
          ? "Your registration was not approved. Please contact the administrator."
          : "Your registration is awaiting administrator approval. You can sign in after it has been approved.",
      });
    }

    /* -----------------------------------------
       Block inactive accounts
       ----------------------------------------- */

    if (user.account_status === "Inactive") {
      await createAuditLog({
        userId: user.id,
        username: user.username,
        role: user.role,
        action: "LOGIN_BLOCKED",
        entityType: "USER",
        entityId: String(user.id),
        details: "Login blocked because the account is inactive.",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.status(403).json({
        success: false,
        message:
          "This account has been disabled. Please contact the administrator.",
      });
    }

    /* -----------------------------------------
       Verify password
       ----------------------------------------- */

    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      await createAuditLog({
        userId: user.id,
        username: user.username,
        role: user.role,
        action: "LOGIN_FAILED",
        entityType: "USER",
        entityId: String(user.id),
        details: "Failed login attempt due to invalid credentials.",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid username or password.",
      });
    }

    /* -----------------------------------------
       Create JWT
       ----------------------------------------- */

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        message: "Authentication service is not configured.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        full_name: user.full_name || user.username,
        role: user.role,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      }
    );

    /* -----------------------------------------
       Audit successful login
       ----------------------------------------- */

    await createAuditLog({
      userId: user.id,
      username: user.username,
      role: user.role,
      action: "LOGIN",
      entityType: "USER",
      entityId: String(user.id),
      details: "User logged into the system.",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    /* -----------------------------------------
       Login response
       ----------------------------------------- */

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name || user.username,
        role: user.role,
        email: user.email,
        account_status: user.account_status || "Active",
      },
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong during login.",
    });
  }
});


/* =========================================================
   LOGOUT AUDIT EVENT
   POST /api/auth/logout
   ========================================================= */
router.post("/logout", authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: req.user.id || null,
      username: req.user.username || null,
      role: req.user.role || null,
      action: "LOGOUT",
      entity_type: "USER",
      entity_id: req.user.id == null ? null : String(req.user.id),
      details: "User logged out of the system.",
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
    });

    if (error) {
      console.error("Logout audit insert error:", error);
      return res.status(500).json({ success: false, message: "Unable to record logout event." });
    }

    return res.json({ success: true, message: "Logout recorded." });
  } catch (error) {
    console.error("Logout audit error:", error);
    return res.status(500).json({ success: false, message: "Unable to record logout event." });
  }
});


/* =========================================================
   CREATE SESSION TOKEN
   ========================================================= */

function createSessionToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      full_name: user.full_name || user.username,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
}


/* =========================================================
   GET MY PROFILE
   GET /api/auth/me

   AUTHENTICATED USER
   ========================================================= */

router.get(
  "/me",
  authenticateToken,
  async (req, res) => {
    try {
      const { data: user, error } = await supabase
        .from("user_accounts")
        .select(
          "id, username, full_name, email, role, account_status"
        )
        .eq("id", req.user.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Supabase profile fetch error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to load your profile.",
        });
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name || user.username,
          email: user.email || "",
          role: user.role || "Staff",
          account_status:
            user.account_status || "Active",
        },
      });

    } catch (error) {
      console.error("Get profile error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while loading your profile.",
      });
    }
  }
);


/* =========================================================
   UPDATE MY PROFILE
   PUT /api/auth/me

   AUTHENTICATED USER
   ========================================================= */

router.put(
  "/me",
  authenticateToken,
  async (req, res) => {
    try {
      const { full_name, username, email } = req.body;

      const updateData = {};

      if (full_name !== undefined) {
        const cleanFullName = String(full_name || "").trim();

        if (!cleanFullName) {
          return res.status(400).json({
            success: false,
            message: "Full name cannot be empty.",
          });
        }

        if (cleanFullName.length > 150) {
          return res.status(400).json({
            success: false,
            message: "Full name must be 150 characters or fewer.",
          });
        }

        updateData.full_name = cleanFullName;
      }

      if (username !== undefined) {
        const cleanUsername = String(
          username || ""
        ).trim();

        if (!cleanUsername) {
          return res.status(400).json({
            success: false,
            message: "Username cannot be empty.",
          });
        }

        /* Check duplicate username (excluding self) */

        const {
          data: existingUser,
          error: existingError,
        } = await supabase
          .from("user_accounts")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", req.user.id)
          .maybeSingle();

        if (existingError) {
          console.error(
            "Profile duplicate username check error:",
            existingError
          );

          return res.status(500).json({
            success: false,
            message: "Unable to validate username.",
          });
        }

        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "Username already exists.",
          });
        }

        updateData.username = cleanUsername;
      }

      if (email !== undefined) {
        const cleanEmail = String(
          email || ""
        ).trim();

        if (
          cleanEmail &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            cleanEmail
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Please enter a valid email address.",
          });
        }

        updateData.email = cleanEmail || null;
      }

      if (
        Object.keys(updateData).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "No changes were provided.",
        });
      }

      const {
        data: updatedUser,
        error,
      } = await supabase
        .from("user_accounts")
        .update(updateData)
        .eq("id", req.user.id)
        .select(
          "id, username, full_name, email, role, account_status"
        )
        .single();

      if (error) {
        console.error(
          "Supabase profile update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: "Unable to update your profile.",
        });
      }

      // Record exactly one audit event for this profile update.
      await createAuditLog({
        userId: req.user.id,
        username: updatedUser.username,
        role: updatedUser.role,
        action: "PROFILE_UPDATED",
        entityType: "USER",
        entityId: String(updatedUser.id),
        details: "Updated own profile information.",
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      /* Issue a fresh token so the session claims stay in sync. */

      const token = createSessionToken(updatedUser);

      return res.json({
        success: true,
        message: "Profile updated successfully.",
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          full_name: updatedUser.full_name || updatedUser.username,
          email: updatedUser.email || "",
          role: updatedUser.role || "Staff",
          account_status:
            updatedUser.account_status || "Active",
        },
        token,
      });

    } catch (error) {
      console.error("Update profile error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while updating your profile.",
      });
    }
  }
);


/* =========================================================
   PUBLIC ACCOUNT REGISTRATION
   POST /api/auth/register
   Public requests are always Staff and must be approved by Admin.
   ========================================================= */
router.post("/register", async (req, res) => {
  try {
    const fullName = String(req.body.full_name || "").trim();
    const username = String(req.body.username || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const { data: registrationSettings, error: settingsError } = await supabase.from("system_settings").select("allow_public_registration").eq("id", 1).maybeSingle();
    if (settingsError) {
      console.error("Registration settings lookup error:", settingsError);
      return res.status(503).json({ success: false, message: "Registration is temporarily unavailable. Please contact the administrator." });
    }
    if (registrationSettings && registrationSettings.allow_public_registration === false) {
      return res.status(403).json({ success: false, message: "Public account registration is currently disabled. Please contact the administrator." });
    }

    if (!fullName || !username || !email || !password) {
      return res.status(400).json({ success: false, message: "Full name, username, email, and password are required." });
    }
    if (fullName.length > 150 || username.length < 3 || username.length > 40) {
      return res.status(400).json({ success: false, message: "Please check your full name and username. Usernames must be 3–40 characters." });
    }
    if (!/^[A-Za-z0-9._-]+$/.test(username)) {
      return res.status(400).json({ success: false, message: "Username may contain only letters, numbers, periods, underscores, and hyphens." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters and include an uppercase letter, a number, and a special character." });
    }

    const { data: existing, error: lookupError } = await supabase
      .from("user_accounts")
      .select("id")
      .or(`username.ilike.${username.replace(/[%_,]/g, "")},email.ilike.${email.replace(/[%_,]/g, "")}`)
      .limit(1);

    if (lookupError) {
      console.error("Registration duplicate check error:", lookupError);
      return res.status(500).json({ success: false, message: "Unable to validate registration details." });
    }
    if (existing && existing.length) {
      return res.status(409).json({ success: false, message: "That username or email is already registered." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: created, error } = await supabase
      .from("user_accounts")
      .insert({
        username,
        full_name: fullName,
        email,
        password_hash: passwordHash,
        role: "staff",
        account_status: "Active",
        approval_status: "Pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Registration insert error:", error);
      if (error.code === "23505") return res.status(409).json({ success: false, message: "That username or email is already registered." });
      return res.status(500).json({ success: false, message: "Unable to submit your registration. Confirm the account approval migration has been applied." });
    }

    await createAuditLog({
      userId: created.id,
      username,
      role: "Staff",
      action: "ACCOUNT_REGISTRATION_SUBMITTED",
      entityType: "USER",
      entityId: String(created.id),
      details: "New Staff registration submitted and is awaiting administrator approval.",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json({
      success: true,
      message: "Registration submitted. Your account is pending administrator approval. You can sign in after it has been approved.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while submitting your registration." });
  }
});


/* =========================================================
   GET ALL USER ACCOUNTS
   GET /api/auth/users

   ADMIN ONLY
   ========================================================= */

router.get(
  "/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      let { data: users, error } = await supabase
        .from("user_accounts")
        .select("id, username, full_name, email, role, account_status, approval_status, created_at")
        .order("id", { ascending: true });

      // Backward compatibility: keep existing personnel visible in Admin
      // while migration 003 has not yet been applied in Supabase.
      const approvalSchemaMissing = error && (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        /approval_status|created_at.*column|column.*created_at/i.test(error.message || "")
      );

      if (approvalSchemaMissing) {
        console.warn("Account approval migration is not applied; loading legacy user account fields.");
        const fallback = await supabase
          .from("user_accounts")
          .select("id, username, full_name, email, role, account_status")
          .order("id", { ascending: true });
        users = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("Supabase users fetch error:", error);
        return res.status(500).json({
          success: false,
          message: "Unable to load user accounts. Check the backend logs for the database error.",
        });
      }

      const { data: loginEvents, error: loginEventsError } = await supabase
        .from("audit_logs")
        .select("username, created_at")
        .eq("action", "LOGIN")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (loginEventsError) {
        console.warn("Unable to load last-active timestamps:", loginEventsError);
      }

      const lastLoginByUsername = new Map();
      for (const event of loginEvents || []) {
        const key = String(event.username || "").trim().toLowerCase();
        if (key && !lastLoginByUsername.has(key)) {
          lastLoginByUsername.set(key, event.created_at);
        }
      }

      return res.json({
        success: true,
        users: (users || []).map((user) => ({
          id: user.id,
          username: user.username,
          full_name: user.full_name || user.username,
          email: user.email || "",
          role: user.role || "Staff",
          account_status:
            user.account_status || "Active",
          approval_status: user.approval_status || "Approved",
          created_at: user.created_at || null,
          last_active_at: lastLoginByUsername.get(String(user.username || "").trim().toLowerCase()) || null,
        })),
      });

    } catch (error) {
      console.error("Get users error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while loading user accounts.",
      });
    }
  }
);


/* =========================================================
   CREATE USER
   POST /api/auth/users

   ADMIN ONLY
   ========================================================= */

router.post(
  "/users",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        username,
        password,
        email,
        role,
        account_status,
        full_name,
      } = req.body;

      const cleanUsername = String(
        username || ""
      ).trim();

      const cleanEmail = String(
        email || ""
      ).trim();

      const cleanRole = normalizeDatabaseRole(role || "staff");

      const cleanStatus =
        account_status === "Inactive"
          ? "Inactive"
          : "Active";

      if (!cleanUsername) {
        return res.status(400).json({
          success: false,
          message: "Username is required.",
        });
      }

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required.",
        });
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and include at least one capital letter, one number, and one special character.",
        });
      }

      if (!cleanRole) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role.",
        });
      }

      /* Check duplicate username */

      const {
        data: existingUser,
        error: existingError,
      } = await supabase
        .from("user_accounts")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingError) {
        console.error(
          "Duplicate username check error:",
          existingError
        );

        return res.status(500).json({
          success: false,
          message: "Unable to validate username.",
        });
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Username already exists.",
        });
      }

      /* Hash password */

      const passwordHash = await bcrypt.hash(
        password,
        10
      );

      /* Insert account */

      const userInsert = {
        username: cleanUsername,
        full_name: String(full_name || cleanUsername).trim(),
        password_hash: passwordHash,
        role: cleanRole,
        email: cleanEmail || null,
        account_status: cleanStatus,
      };

      const { data: newUser, error } = await supabase
        .from("user_accounts")
        .insert(userInsert)
        .select("id, username, full_name, email, role, account_status")
        .single();

      if (error) {
        console.error(
          "Supabase create user error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: error.message || "Unable to create user account.",
          code: error.code || null,
        });
      }

      await createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: String(newUser.id),
        details:
          `Created user account: ${newUser.username}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.status(201).json({
        success: true,
        message: "User account created successfully.",
        user: newUser,
      });

    } catch (error) {
      console.error("Create user error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while creating the user account.",
      });
    }
  }
);


/* =========================================================
   UPDATE USER
   PUT /api/auth/users/:id

   ADMIN ONLY
   ========================================================= */

router.put(
  "/users/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;

      const {
        username,
        email,
        role,
        account_status,
        full_name,
      } = req.body;

      if (Object.prototype.hasOwnProperty.call(req.body, "password")) {
        return res.status(403).json({
          success: false,
          message: "Administrators cannot change another user's password.",
        });
      }

      const updateData = {};

      if (full_name !== undefined) {
        const cleanFullName = String(full_name || "").trim();
        if (!cleanFullName) {
          return res.status(400).json({ success: false, message: "Full name cannot be empty." });
        }
        updateData.full_name = cleanFullName;
      }

      if (username !== undefined) {
        const cleanUsername =
          String(username).trim();

        if (!cleanUsername) {
          return res.status(400).json({
            success: false,
            message: "Username cannot be empty.",
          });
        }

        updateData.username = cleanUsername;
      }

      if (email !== undefined) {
        updateData.email =
          String(email || "").trim() || null;
      }

      if (role !== undefined) {
        const normalizedRole = normalizeDatabaseRole(role);

        if (!normalizedRole) {
          return res.status(400).json({
            success: false,
            message: "Invalid user role. Choose Admin, Staff, or ID Maker.",
          });
        }

        updateData.role = normalizedRole;
      }

      if (account_status !== undefined) {
        if (
          !["Active", "Inactive"].includes(
            account_status
          )
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid account status.",
          });
        }

        updateData.account_status =
          account_status;
      }

      if (
        Object.keys(updateData).length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "No changes were provided.",
        });
      }

      const { data: updatedUser, error } = await supabase
        .from("user_accounts")
        .update(updateData)
        .eq("id", userId)
        .select("id, username, full_name, email, role, account_status")
        .single();

      if (error) {
        console.error(
          "Supabase update user error:",
          error
        );

        return res.status(500).json({
          success: false,
          message: error.message || "Unable to update user account.",
          code: error.code || null,
        });
      }

      await createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: String(updatedUser.id),
        details:
          `Updated user account: ${updatedUser.username}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.json({
        success: true,
        message:
          "User account updated successfully.",
        user: updatedUser,
      });

    } catch (error) {
      console.error("Update user error:", error);

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while updating the user account.",
      });
    }
  }
);


/* =========================================================
   RESET PASSWORD
   PUT /api/auth/users/:id/password

   ADMIN ONLY
   ========================================================= */

router.put(
  "/users/:id/password",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    return res.status(403).json({
      success: false,
      message: "Administrators cannot change another user's password. The account owner must use the password recovery process.",
    });
  }
);

/* =========================================================
   APPROVE / REJECT REGISTRATION
   PUT /api/auth/users/:id/approval
   ADMIN ONLY
   ========================================================= */
router.put("/users/:id/approval", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const approval_status = String(req.body.approval_status || "").trim();
    if (!["Approved", "Rejected"].includes(approval_status)) {
      return res.status(400).json({ success: false, message: "Approval status must be Approved or Rejected." });
    }

    const { data: current, error: readError } = await supabase
      .from("user_accounts")
      .select("id, username, approval_status")
      .eq("id", req.params.id)
      .maybeSingle();

    if (readError) {
      console.error("Registration review lookup error:", readError);
      return res.status(500).json({ success: false, message: "Unable to load the registration." });
    }
    if (!current) return res.status(404).json({ success: false, message: "Account not found." });
    if ((current.approval_status || "Approved") !== "Pending") {
      return res.status(409).json({ success: false, message: "This registration has already been reviewed." });
    }

    const { data: updated, error } = await supabase
      .from("user_accounts")
      .update({ approval_status })
      .eq("id", req.params.id)
      .eq("approval_status", "Pending")
      .select("id, username, full_name, email, role, account_status, approval_status")
      .maybeSingle();

    if (error) {
      console.error("Registration approval update error:", error);
      return res.status(500).json({ success: false, message: "Unable to update this registration. Confirm the approval migration has been applied." });
    }
    if (!updated) return res.status(409).json({ success: false, message: "This registration was already reviewed by another administrator." });

    await createAuditLog({
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: approval_status === "Approved" ? "ACCOUNT_REGISTRATION_APPROVED" : "ACCOUNT_REGISTRATION_REJECTED",
      entityType: "USER",
      entityId: String(updated.id),
      details: `${approval_status} registration for ${updated.username}.`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({ success: true, message: `Registration ${approval_status.toLowerCase()} successfully.`, user: updated });
  } catch (error) {
    console.error("Registration review error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong while reviewing this registration." });
  }
});


/* =========================================================
   ENABLE / DISABLE USER
   PUT /api/auth/users/:id/status

   ADMIN ONLY
   ========================================================= */

router.put(
  "/users/:id/status",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const { account_status } = req.body;

      if (
        !["Active", "Inactive"].includes(
          account_status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Account status must be Active or Inactive.",
        });
      }

      const {
        data: updatedUser,
        error,
      } = await supabase
        .from("user_accounts")
        .update({
          account_status,
        })
        .eq("id", userId)
        .select(
          "id, username, email, role, account_status"
        )
        .single();

      if (error) {
        console.error(
          "Supabase status update error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Unable to update account status.",
        });
      }

      const action =
        updatedUser.account_status === "Active"
          ? "USER_ACTIVATED"
          : "USER_DEACTIVATED";

      const details =
        updatedUser.account_status === "Active"
          ? `Activated user account: ${updatedUser.username}`
          : `Deactivated user account: ${updatedUser.username}`;

      await createAuditLog({
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role,
        action,
        entityType: "USER",
        entityId: String(updatedUser.id),
        details,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });

      return res.json({
        success: true,
        message:
          `Account ${account_status.toLowerCase()} successfully.`,
        user: updatedUser,
      });

    } catch (error) {
      console.error(
        "Update account status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Something went wrong while updating account status.",
      });
    }
  }
);


/* =========================================================
   FORGOT PASSWORD - OTP EMAIL CONFIGURATION
   ========================================================= */


function hashResetOtp(otp) {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}


/* =========================================================
   REQUEST PASSWORD RESET OTP
   POST /api/auth/forgot-password
   Body: { email }
   ========================================================= */

router.post("/forgot-password", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const { data: user, error } = await supabase
      .from("user_accounts")
      .select("id, username, email, account_status")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      console.error("Password reset lookup error:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to process your request right now.",
      });
    }

    // Use the same response whether or not an account exists.
    if (!user || user.account_status !== "Active") {
      return res.json({
        success: true,
        message:
          "If an active account matches that email, an OTP will be sent.",
      });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = hashResetOtp(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
      .toISOString();

    // Invalidate any previous unused reset codes for this user.
    const { error: invalidateError } = await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("used_at", null);

    if (invalidateError) {
      console.error("OTP invalidation error:", invalidateError);
      return res.status(500).json({
        success: false,
        message: "Unable to process your request right now.",
      });
    }

    const { error: insertError } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("OTP database error:", insertError);
      return res.status(500).json({
        success: false,
        message: "Unable to generate a reset code.",
      });
    }

    try {
      if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
        throw new Error("Brevo API configuration is missing.");
      }

      const emailResponse = await fetch(
        "https://api.brevo.com/v3/smtp/email",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            sender: {
              name: process.env.BREVO_SENDER_NAME || "Record Management System",
              email: process.env.BREVO_SENDER_EMAIL,
            },
            to: [
              {
                email: user.email,
              },
            ],
            subject: "Record Management System - Password Reset OTP",
            textContent:
              `Hello,\n\n` +
              `Your password reset code is: ${otp}\n\n` +
              `This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.\n\n` +
              `Record Management System`,
          }),
        }
      );

      if (!emailResponse.ok) {
        const details = await emailResponse.text();
        throw new Error(
          `Brevo email API failed (${emailResponse.status}): ${details}`
        );
      }

    } catch (mailError) {
      console.error("OTP email sending error:", mailError);

      // Invalidate the code if sending the email failed.
      await supabase
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("token_hash", tokenHash)
        .is("used_at", null);

      return res.status(500).json({
        success: false,
        message: "Unable to send the OTP email. Please try again later.",
      });
    }

    return res.json({
      success: true,
      message:
        "If an active account matches that email, an OTP will be sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
});


/* =========================================================
   VERIFY OTP AND RESET PASSWORD
   POST /api/auth/reset-password
   Body: { email, otp, newPassword }
   ========================================================= */

router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "");

    if (!email || !/^\d{6}$/.test(otp) || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, six-digit OTP, and new password are required.",
      });
    }

    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
      });
    }

    const { data: user, error: userError } = await supabase
      .from("user_accounts")
      .select("id, email, account_status")
      .ilike("email", email)
      .maybeSingle();

    if (userError) {
      console.error("Reset account lookup error:", userError);
      return res.status(500).json({
        success: false,
        message: "Unable to process the password reset.",
      });
    }

    if (!user || user.account_status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    const { data: resetToken, error: tokenError } = await supabase
      .from("password_reset_tokens")
      .select("id, token_hash, expires_at")
      .eq("user_id", user.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error("OTP verification lookup error:", tokenError);
      return res.status(500).json({
        success: false,
        message: "Unable to verify the OTP.",
      });
    }

    if (
      !resetToken ||
      resetToken.token_hash !== hashResetOtp(otp)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP.",
      });
    }

    // Hash the new password only after the OTP has been verified.
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Claim the OTP before changing the password to prevent reuse.
    const { data: claimedToken, error: claimError } = await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("id")
      .maybeSingle();

    if (claimError || !claimedToken) {
      if (claimError) {
        console.error("OTP claim error:", claimError);
      }

      return res.status(400).json({
        success: false,
        message: "Invalid, expired, or already used OTP.",
      });
    }

    const { error: passwordError } = await supabase
      .from("user_accounts")
      .update({ password_hash: passwordHash })
      .eq("id", user.id);

    if (passwordError) {
      console.error("Password update error:", passwordError);

      return res.status(500).json({
        success: false,
        message:
          "Unable to update the password. Please request a new OTP.",
      });
    }

    await createAuditLog({
      userId: user.id,
      username: user.username,
      action: "PASSWORD_CHANGED",
      entityType: "USER",
      entityId: String(user.id),
      details: "User changed their password after OTP verification.",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({
      success: true,
      message:
        "Password reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
});


module.exports = router;