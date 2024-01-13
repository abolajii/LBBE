const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    ticketId: {
      type: String, // You can choose the appropriate data type for ticket IDs
      required: true,
    },
    suspended: {
      type: Boolean,
      default: false, //Set the default status to "pending"
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending", // Set the default status to "pending"
    },
  },
  {
    timestamps: true,
  }
);

const Report = mongoose.model("Report", reportSchema);

module.exports = { Report };
