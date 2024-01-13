const mongoose = require("mongoose");

const userActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  likes: { type: Number, default: 0 },
  matches: { type: Number, default: 0 },
  swipes: { type: Number, default: 0 },
});

const UserActivity = mongoose.model("UserActivity", userActivitySchema);

module.exports = { UserActivity };
