const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createChannel,
  fetchChannels,
  joinChannel,
  leaveChannel, // <--- Import this
  sendMessage,
  fetchMessages,
} = require("../controllers/chatController");

const router = express.Router();

router.route("/channel").post(protect, createChannel);
router.route("/channels").get(protect, fetchChannels);
router.route("/channel/join").put(protect, joinChannel);
router.route("/channel/leave").put(protect, leaveChannel); // <--- Add this

router.route("/message").post(protect, sendMessage);
router.route("/message/:channelId").get(protect, fetchMessages);

module.exports = router;