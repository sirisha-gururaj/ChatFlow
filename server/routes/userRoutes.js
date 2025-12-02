const express = require("express");
const {
  registerUser,
  authUser,
  allUsers,
  renameUser, // <--- Import
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").post(registerUser).get(protect, allUsers);
router.post("/login", authUser);
router.put("/rename", protect, renameUser); // <--- New Route

module.exports = router;