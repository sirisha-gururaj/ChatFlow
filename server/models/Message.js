const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    
    // --- NEW FIELDS FOR DELETION LOGIC ---
    // Array of users who deleted this message for themselves
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], 
    // Flag if deleted for everyone (so we can style it differently if needed)
    isDeletedForAll: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;