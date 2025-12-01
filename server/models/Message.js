const mongoose = require("mongoose");

const messageSchema = mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    content: { type: String, trim: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Optional: For read receipts
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;