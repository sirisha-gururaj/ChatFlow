const User = require("../models/UserModel");
const generateToken = require("../config/generateToken");

const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400).json({ message: "Please Enter all the Fields" });
    return;
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400).json({ message: "User already exists" });
    return;
  }
  const user = await User.create({ username, email, password });
  if (user) {
    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } else {
    res.status(400).json({ message: "Failed to Create the User" });
  }
};

const authUser = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ message: "Invalid Email or Password" });
  }
};

const allUsers = async (req, res) => {
  const keyword = req.query.search
    ? {
        $or: [
          { username: { $regex: req.query.search, $options: "i" } },
          { email: { $regex: req.query.search, $options: "i" } },
        ],
      }
    : {};
  const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
  res.send(users);
};

// --- NEW: Rename User ---
const renameUser = async (req, res) => {
  const { newName } = req.body;
  
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { username: newName },
    { new: true }
  ).select("-password");

  if (!updatedUser) {
    res.status(404).json({ message: "User not found" });
  } else {
    res.json({
      _id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      token: generateToken(updatedUser._id),
    });
  }
};

module.exports = { registerUser, authUser, allUsers, renameUser };