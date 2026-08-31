const crypto = require("crypto");
const prisma = require("../config/database");

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

// GET /api/users (List all users)
exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users (Create new staff account)
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ success: false, message: "Email already exists." });

    const newUser = await prisma.user.create({
      data: {
        firstName, lastName, email,
        password: hashPassword(password),
        role: 'USER' // Staff always start as regular USER
      }
    });
    await prisma.settings.create({ data: { userId: newUser.id } }).catch(() => {});

    res.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      user: { id: newUser.id, firstName: newUser.firstName, lastName: newUser.lastName, email: newUser.email, role: newUser.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/users/:id (Delete staff account)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.userId) return res.status(400).json({ success: false, message: "You cannot delete your own account." });
    
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: "User not found." });
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/users/:id/reset-password (Super Admin resets a user's password)
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    await prisma.user.update({
      where: { id },
      data: { password: hashPassword(password) }
    });

    res.json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: "User not found." });
    res.status(500).json({ success: false, message: error.message });
  }
};