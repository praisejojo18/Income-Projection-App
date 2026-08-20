const router = require('express').Router();

/*
  SAFE ROUTE LOADER
  - Healthy route file  → mounted with ✅
  - Empty/broken file   → skipped with ⚠️ (server keeps running)
  No more commenting/uncommenting lines ever again.
*/
const mount = (path, loader, name) => {
  try {
    const mod = loader();
    if (typeof mod === "function") {
      router.use(path, mod);
      console.log(`✅ Mounted  ${path}  (${name})`);
    } else {
      console.warn(`⚠️  Skipped  ${path}  (${name}) — does not export a router (empty file?)`);
    }
  } catch (err) {
    console.warn(`⚠️  Skipped  ${path}  (${name}) — load error: ${err.message}`);
  }
};

// Colleague's routes
mount("/auth", () => require("./authRoutes"), "authRoutes");
mount("/plans", () => require("./planRoutes"), "planRoutes");
mount("/settings", () => require("./settingsRoutes"), "settingsRoutes");
mount("/payments", () => require("./paymentRoutes"), "paymentRoutes");
mount("/projections", () => require("./projectionRoutes"), "projectionRoutes");

// YOUR routes
mount("/customers", () => require("./customerRoutes"), "customerRoutes");
mount("/actual", () => require("./actualRoutes"), "actualRoutes");
mount("/dashboard", () => require("./dashboardRoutes"), "dashboardRoutes");

// ✅ YOUR ROUTES 
router.use('/settings', require('./settingsRoutes'));
router.use('/plans', require('./planRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/projections', require('./projectionRoutes'));

module.exports = router;
