const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createChannel,
  fetchChannels,
  joinChannel,
  sendMessage,
  fetchMessages,
} = require("../controllers/chatController");

const router = express.Router();

// Channel Routes
router.route("/channel").post(protect, createChannel);
router.route("/channels").get(protect, fetchChannels);
router.route("/channel/join").put(protect, joinChannel);

// Message Routes
router.route("/message").post(protect, sendMessage);
router.route("/message/:channelId").get(protect, fetchMessages);

module.exports = router;