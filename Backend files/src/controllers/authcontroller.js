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