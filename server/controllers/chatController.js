const Channel = require("../models/Channel");
const Message = require("../models/Message");
const User = require("../models/UserModel");

// @desc    Create a new channel
// @route   POST /api/chat/channel
const createChannel = async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: "Channel name is required" });

  try {
    const channel = await Channel.create({
      name,
      description,
      admin: req.user._id,
      members: [req.user._id],
    });
    // Populate immediately so we can display it correctly
    const fullChannel = await Channel.findOne({ _id: channel._id }).populate(
      "members",
      "-password"
    );
    res.status(201).json(fullChannel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Fetch all channels (with member details)
// @route   GET /api/chat/channels
const fetchChannels = async (req, res) => {
  try {
    const channels = await Channel.find({}).populate("members", "-password");
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
      { $addToSet: { members: req.user._id } },
      { new: true }
    ).populate("members", "-password");
    res.json(added);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Leave a channel (NEW)
// @route   PUT /api/chat/channel/leave
const leaveChannel = async (req, res) => {
  const { channelId } = req.body;
  try {
    const removed = await Channel.findByIdAndUpdate(
      channelId,
      { $pull: { members: req.user._id } }, // $pull removes the item from array
      { new: true }
    ).populate("members", "-password");
    res.json(removed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Send a message
// @route   POST /api/chat/message
const sendMessage = async (req, res) => {
  const { content, channelId } = req.body;
  if (!content || !channelId) return res.status(400).json({ message: "Invalid data passed" });

  var newMessage = {
    sender: req.user._id,
    content: content,
    channel: channelId,
  };

  try {
    var message = await Message.create(newMessage);
    message = await message.populate("sender", "username avatar");
    message = await message.populate("channel");
    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Fetch messages (Pagination included)
// @route   GET /api/chat/message/:channelId
const fetchMessages = async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;

  try {
    const messages = await Message.find({ channel: req.params.channelId })
      .populate("sender", "username avatar email")
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize);

    res.json(messages.reverse());
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createChannel,
  fetchChannels,
  joinChannel,
  leaveChannel,
  sendMessage,
  fetchMessages,
};