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
    const channels = await Channel.find({ members: req.user._id })
      .populate("members", "-password")
      .sort({ updatedAt: -1 });
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

const deleteChannel = async (req, res) => {
  const channelId = req.params.channelId;
  try {
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
    let query = { 
        channel: req.params.channelId,
        // Exclude "Delete for me" messages from general history
        deletedFor: { $ne: req.user._id } 
    };

    const messages = await Message.find(query)
      .populate("sender", "username avatar email")
      .sort({ createdAt: -1 })
      .skip(pageSize * (page - 1))
      .limit(pageSize);
    
    const channel = await Channel.findById(req.params.channelId);
    
    res.json({
      messages: messages.reverse(),
      isDeleted: channel ? channel.isDeleted : false
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const editMessage = async (req, res) => {
  const { messageId, content } = req.body;
  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized to edit this message" });
    }

    message.content = content;
    await message.save();
    
    const fullMessage = await Message.findById(messageId)
      .populate("sender", "username avatar")
      .populate("channel");

    res.json(fullMessage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteMessage = async (req, res) => {
  const messageId = req.params.messageId;
  const { deleteType } = req.body; 

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized to delete this message" });
    }

    if (deleteType === "everyone") {
        // OVERWRITE the content in the DB. The original text is lost.
        message.content = `This message was deleted by ${req.user.username}`;
        message.isDeletedForAll = true;
        await message.save();
        
        const fullMessage = await Message.findById(messageId)
            .populate("sender", "username avatar")
            .populate("channel");
            
        return res.json({ type: "everyone", message: fullMessage });
    } 
    else if (deleteType === "me") {
        // Keep content for others, but hide it for me
        if (!message.deletedFor.includes(req.user._id)) {
            message.deletedFor.push(req.user._id);
            await message.save();
        }
        return res.json({ type: "me", messageId });
    } 
    else {
        return res.status(400).json({ message: "Invalid delete type" });
    }

  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// --- UPDATED: Search Global Messages ---
const searchGlobalMessages = async (req, res) => {
  const keyword = req.query.search;
  if (!keyword) return res.json([]);

  try {
    const userChannels = await Channel.find({ members: req.user._id }).distinct('_id');

    const messages = await Message.find({
      channel: { $in: userChannels },
      content: { $regex: keyword, $options: "i" },
      // 1. Exclude messages deleted for this specific user
      deletedFor: { $ne: req.user._id }, 
      // 2. Exclude messages deleted for everyone (so they don't show in search results)
      isDeletedForAll: { $ne: true } 
    })
    .populate("sender", "username avatar")
    .populate("channel", "name")
    .sort({ createdAt: -1 })
    .limit(50); 

    res.json(messages);
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
  editMessage,
  deleteMessage,
  searchGlobalMessages,
};