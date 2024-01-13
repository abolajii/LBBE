const mongoose = require("mongoose");

// Define the Block schema
const blockSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  blockedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Create the Block model
const Block = mongoose.model("Block", blockSchema);

module.exports = { Block };
