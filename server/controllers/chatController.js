const Channel = require("../models/Channel");
const Message = require("../models/Message");
const User = require("../models/UserModel");

const createChannel = async (req, res) => {
  const { name, description, isPrivate, password } = req.body;
  if (!name) return res.status(400).json({ message: "Channel name is required" });
  if (isPrivate && !password) return res.status(400).json({ message: "Password is required for private channels" });

  try {
    const channel = await Channel.create({
      name,
      description,
      isPrivate: isPrivate || false,
      password: password || null,
      admin: req.user._id,
      members: [req.user._id],
    });
    const fullChannel = await Channel.findOne({ _id: channel._id }).populate("members", "-password");
    res.status(201).json(fullChannel);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const fetchChannels = async (req, res) => {
  try {
    const channels = await Channel.find({}).populate("members", "-password");
    res.json(channels);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const joinChannel = async (req, res) => {
  const { channelId, password } = req.body;
  try {
    const channelToCheck = await Channel.findById(channelId).select("+password");
    if (!channelToCheck) return res.status(404).json({ message: "Channel not found" });
    if (channelToCheck.isDeleted) return res.status(400).json({ message: "Channel is deleted" });

    if (channelToCheck.isPrivate) {
      if (!password || password !== channelToCheck.password) {
        return res.status(401).json({ message: "Invalid Password" });
      }
    }
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

const leaveChannel = async (req, res) => {
  const { channelId } = req.body;
  try {
    const removed = await Channel.findByIdAndUpdate(
      channelId,
      { $pull: { members: req.user._id } },
      { new: true }
    ).populate("members", "-password");
    res.json(removed);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// --- NEW: Soft Delete Channel ---
const deleteChannel = async (req, res) => {
  const channelId = req.params.channelId;
  try {
    // Only set isDeleted to true, don't remove from DB so history is preserved
    const deleted = await Channel.findByIdAndUpdate(
      channelId,
      { isDeleted: true },
      { new: true }
    );
    res.json(deleted);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const sendMessage = async (req, res) => {
  const { content, channelId } = req.body;
  if (!content || !channelId) return res.status(400).json({ message: "Invalid data passed" });

  try {
    // Check if channel is deleted
    const channel = await Channel.findById(channelId);
    if(channel.isDeleted) return res.status(400).json({message: "Cannot send message to deleted channel"});

    var newMessage = {
      sender: req.user._id,
      content: content,
      channel: channelId,
    };
    var message = await Message.create(newMessage);
    message = await message.populate("sender", "username avatar");
    message = await message.populate("channel");
    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const fetchMessages = async (req, res) => {
  const pageSize = 20;
  const page = Number(req.query.page) || 1;
  try {
    const messages = await Message.find({ channel: req.params.channelId })
      .populate("sender", "username avatar email")
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize);
    
    // We also return channel status to let frontend know if it's deleted
    const channel = await Channel.findById(req.params.channelId);
    
    res.json({
      messages: messages.reverse(),
      isDeleted: channel ? channel.isDeleted : false
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createChannel,
  fetchChannels,
  joinChannel,
  leaveChannel,
  deleteChannel,
  sendMessage,
  fetchMessages,
};