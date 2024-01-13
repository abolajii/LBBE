const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    gender: { type: String },
    location: { type: String },
    bio: { type: String },
    dob: { type: String },
    my_interests: {
      type: [String],
    },
    interested_gender: { type: String },
    phone: {
      type: String,
      // unique: true
    },

    stripeCustomerId: { type: String }, // Store the Stripe Customer ID here

    photos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Photo" }], // Reference to the Photo model

    preferences: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Preference",
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
    },

    refreshToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshToken",
    },

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Block",
      },
    ],
    lastActive: { type: Date },

    swipeLimit: { type: Number }, // Add swipeLimit to the user schema

    coords: {
      type: {
        type: String,
        enum: ["Point"], // Only 'Point' type is allowed
        // required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        // required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ "coords.coordinates": "2dsphere" });

// Add pre-save hook to ensure lowercase gender
userSchema.pre("save", function (next) {
  if (this.gender) {
    this.gender = this.gender.toLowerCase();
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = { User };
