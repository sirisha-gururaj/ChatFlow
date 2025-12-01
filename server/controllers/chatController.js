const Channel = require("../models/channel");
const Message = require("../models/Message");
const User = require("../models/UserModel"); // Ensure we use the correct UserModel file

// @desc    Create a new channel
// @route   POST /api/chat/channel
const createChannel = async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Channel name is required" });
  }

  try {
    const channel = await Channel.create({
      name,
      description,
      admin: req.user._id,
      members: [req.user._id], // Creator is automatically a member
    });
    res.status(201).json(channel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Fetch all channels
// @route   GET /api/chat/channels
const fetchChannels = async (req, res) => {
  try {
    const channels = await Channel.find({});
    res.json(channels);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Join a channel
// @route   PUT /api/chat/channel/join
const joinChannel = async (req, res) => {
  const { channelId } = req.body;

  try {
    const added = await Channel.findByIdAndUpdate(
      channelId,
      { $addToSet: { members: req.user._id } }, // $addToSet prevents duplicates
      { new: true }
    );
    res.json(added);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/chat/message
const sendMessage = async (req, res) => {
  const { content, channelId } = req.body;

  if (!content || !channelId) {
    return res.status(400).json({ message: "Invalid data passed" });
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    channel: channelId,
  };

  try {
    var message = await Message.create(newMessage);

    // Populate the sender field so we get username and avatar immediately
    message = await message.populate("sender", "username avatar");
    message = await message.populate("channel");

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Fetch all messages for a channel
// @route   GET /api/chat/message/:channelId
const fetchMessages = async (req, res) => {
  try {
    const messages = await Message.find({ channel: req.params.channelId })
      .populate("sender", "username avatar email")
      .sort({ createdAt: 1 }); // Oldest first (like standard chat history)

    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createChannel,
  fetchChannels,
  joinChannel,
  sendMessage,
  fetchMessages,
};