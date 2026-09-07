const router = require('express').Router();

const mount = (path, loader, name) => {
  try {
    const mod = loader();
    if (typeof mod === "function") {
      router.use(path, mod);
      console.log(`✅ Mounted  ${path}  (${name})`);
    } else {
      console.warn(`⚠️  Skipped  ${path}  (${name}) — does not export a router`);
    }
  } catch (err) {
    console.warn(`⚠️  Skipped  ${path}  (${name}) — load error: ${err.message}`);
  }
};

mount("/auth", () => require("./authRoutes"), "authRoutes");
mount("/plans", () => require("./planRoutes"), "planRoutes");
mount("/settings", () => require("./settingsRoutes"), "settingsRoutes");
mount("/payments", () => require("./paymentRoutes"), "paymentRoutes");
mount("/projections", () => require("./projectionRoutes"), "projectionRoutes");
mount("/customers", () => require("./customerRoutes"), "customerRoutes");
router.use('/import', require('./importRoutes'));
mount("/actual", () => require("./actualRoutes"), "actualRoutes");
mount("/dashboard", () => require("./dashboardRoutes"), "dashboardRoutes");

// 🛡️ NEW: User Management Route (Super Admin Only)
mount("/users", () => require("./userRoutes"), "userRoutes");

module.exports = router;