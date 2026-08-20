<<<<<<< Updated upstream
const prisma = require("../config/database");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find the user in the database
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found. Check Prisma Studio for the email." });

    // Generate a JWT token
    const secret = process.env.JWT_SECRET || "prontolog_super_secret_jwt_key";
    const token = jwt.sign(
      { id: user.id, email: user.email }, 
      secret, 
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token, // 👈 This is what you need for the Plans!
      user: { id: user.id, firstName: user.firstName, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
=======
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { asyncHandler, ApiError } = require('../utils/helpers');

// Helper: sign a JWT for a user (matches your auth middleware format)
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Helper: shape user for responses (NEVER exposes the password)
const shapeUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  fullName: `${user.firstName} ${user.lastName}`,
  createdAt: user.createdAt,
});

// ─────────────────────────────────────────────
// POST /api/auth/register — Create new account
// ─────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // 1. Validation
  if (!firstName || !firstName.trim()) throw new ApiError(400, 'First name is required');
  if (!lastName || !lastName.trim()) throw new ApiError(400, 'Last name is required');
  if (!email || !email.includes('@')) throw new ApiError(400, 'A valid email is required');
  if (!password || password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');

  // 2. Check if email already exists
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) throw new ApiError(409, 'An account with this email already exists');

  // 3. Hash password + create user
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    },
  });

  // 4. Return token + user
  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      token: signToken(user.id),
      user: shapeUser(user),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/auth/login — Authenticate user
// ─────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Validation
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  // 2. Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // 3. Verify password (generic message prevents email-guessing attacks)
  if (!user) throw new ApiError(401, 'Invalid email or password');

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new ApiError(401, 'Invalid email or password');

  // 4. Return token + user
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      token: signToken(user.id),
      user: shapeUser(user),
    },
  });
});

// ─────────────────────────────────────────────
// GET /api/auth/me — Current user profile (protected)
// ─────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new ApiError(404, 'User not found');

  res.json({ success: true, data: shapeUser(user) });
});

module.exports = { register, login, getMe };
>>>>>>> Stashed changes
