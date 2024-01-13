const mongoose = require("mongoose");

const preferencechema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // No longer required
    },
    age: { type: [Number], default: [] },
    distance: {
      type: Number,
      default: 0,
      // No longer required
    },
    drinking: {
      type: String,
      // No longer required
    },
    education: {
      type: String,
      // No longer required
    },
    ethnicity: {
      type: String,
      // No longer required
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      // No longer required
    },
    height: {
      type: [String],
      default: [],
      // No longer required
    },
    kids: {
      type: String,
      // No longer required
    },
    relationship_goals: {
      type: String,
      // No longer required
    },
    religion: {
      type: String,
      // No longer required
    },
    smoking: {
      type: String,
      // No longer required
    },
  },
  {
    timestamps: true,
  }
);

const Preference = mongoose.model("Preference", preferencechema);

module.exports = { Preference };
