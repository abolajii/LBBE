const mongoose = require("mongoose");

// Define the Photo schema
const photoSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

// Define the Photo model
const Photo = mongoose.model("Photo", photoSchema);

module.exports = { Photo };
