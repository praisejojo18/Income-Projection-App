const prisma = require("../config/database");
const crypto = require("crypto");
const { Prisma } = require("@prisma/client");

/* Same hashing as authController.js (crypto.scryptSync) */
const hashPassword = (pw) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return salt + ":" + hash;
};

function getUserId(req) {
  return (
    req.userId ||
    req.user?.id ||
    req.user?.userId ||
    req.headers["x-user-id"] ||
    process.env.DEFAULT_USER_ID
  );
}

/* 🧠 Auto-detect User model columns at runtime (name vs firstName/lastName) */
const userModel = (Prisma.dmmf.datamodel.models || []).find((m) => m.name === "User");
const USER_FIELDS = userModel ? userModel.fields.map((f) => f.name) : [];
const HAS_NAME = USER_FIELDS.includes("name");
const HAS_FIRST = USER_FIELDS.includes("firstName");
const HAS_LAST = USER_FIELDS.includes("lastName");
const lastField = userModel && HAS_LAST ? userModel.fields.find((f) => f.name === "lastName") : null;
const LAST_REQUIRED = lastField ? lastField.isRequired : false;

const displayName = (u) =>
  (HAS_NAME && u.name ? u.name : [u.firstName, u.lastName].filter(Boolean).join(" ")) ||
  String(u.email || "").split("@")[0];

async function requireAdmin(req, res) {
  const requester = await prisma.user.findUnique({ where: { id: req.realUserId || getUserId(req) } });
  if (!requester || requester.role !== "SUPER_ADMIN") {
    res.status(403).json({ error: "Admin privileges required" });
    return false;
  }
  return true;
}

/* GET /api/admin/me */
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.realUserId || getUserId(req) } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user.id, name: displayName(user), email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* GET /api/admin/users */
exports.listUsers = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json(users.map((u) => ({
      id: u.id,
      name: displayName(u),
      email: u.email,
      role: u.role,
      createdAt: u.createdAt
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* POST /api/admin/users — schema-safe create */
exports.createUser = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const exists = await prisma.user.findFirst({ where: { email } });
    if (exists) return res.status(409).json({ error: "A user with this email already exists" });

    // Split "John Doe" → firstName: John, lastName: Doe
    const parts = String(name || email.split("@")[0]).trim().split(/\s+/);
    const first = parts[0] || String(email).split("@")[0];
    const last = parts.slice(1).join(" ");

    const data = {
      email,
      password: hashPassword(password),
      role: role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER"
    };
    if (HAS_NAME) data.name = String(name || first).trim();
    if (HAS_FIRST) data.firstName = first;
    if (HAS_LAST) data.lastName = last || (LAST_REQUIRED ? "" : null);

    const user = await prisma.user.create({ data });
    res.status(201).json({
      success: true,
      message: `User "${user.email}" created.`,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("createUser error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/* PUT /api/admin/users/:id/password */
exports.changePassword = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashPassword(password) } });
    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* PUT /api/admin/users/:id/role */
exports.changeRole = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { role } = req.body;
    if (!["USER", "SUPER_ADMIN"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* DELETE /api/admin/users/:id */
exports.deleteUser = async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    if (req.params.id === (req.realUserId || getUserId(req))) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};