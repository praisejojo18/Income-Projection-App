const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

router.get("/me", adminController.getMe);
router.get("/users", adminController.listUsers);
router.put("/users/:id/role", adminController.changeRole);
router.delete("/users/:id", adminController.deleteUser);
router.post("/users", adminController.createUser);
router.put("/users/:id/password", adminController.changePassword);
module.exports = router;