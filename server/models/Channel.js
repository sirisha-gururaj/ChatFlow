const mongoose = require("mongoose");

const channelSchema = mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    description: { type: String, default: "Welcome to this channel!" },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Channel = mongoose.model("Channel", channelSchema);

module.exports = Channel;