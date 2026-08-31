const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../config/database");

const JWT_SECRET = process.env.JWT_SECRET || "prontolog_super_secret_jwt_key_12345";

/* ---- Password hashing (scrypt, no extra dependency) ---- */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  try {
    if (!stored || typeof stored !== "string" || !stored.includes(":")) return false;
    const [salt, hash] = stored.split(":");
    const computed = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
  } catch (e) {
    return false;
  }
};

// 🔑 CRUCIAL FIX: signs with `userId` to match his auth.js middleware
const signToken = (user) =>
  jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  const publicUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role  // 👈 ADD THIS LINE
});



/* ---- POST /api/auth/login ---- */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    res.json({ 
      success: true, 
      message: "Login successful.", 
      token: signToken(user), 
      user: publicUser(user) 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ---- GET /api/auth/me ---- */
exports.me = async (req, res) => {
  try {
    // req.userId is set by his authenticate middleware
    const userId = req.userId || req.user?.id; 
    if (!userId) return res.status(401).json({ success: false, message: "Not authenticated." });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};