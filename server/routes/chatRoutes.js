const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createChannel,
  fetchChannels,
  joinChannel,
  leaveChannel,
  deleteChannel,
  sendMessage,
  fetchMessages,
  editMessage,
  deleteMessage,
  searchGlobalMessages, // Import
} = require("../controllers/chatController");

const router = express.Router();

router.route("/channel").post(protect, createChannel);
router.route("/channels").get(protect, fetchChannels);
router.route("/channel/join").put(protect, joinChannel);
router.route("/channel/leave").put(protect, leaveChannel);
router.route("/channel/:channelId").delete(protect, deleteChannel);

// --- NEW SEARCH ROUTE ---
router.route("/search").get(protect, searchGlobalMessages);

router.route("/message").post(protect, sendMessage);
router.route("/message/:channelId").get(protect, fetchMessages);
router.route("/message/edit").put(protect, editMessage);
router.route("/message/:messageId").delete(protect, deleteMessage);

module.exports = router;