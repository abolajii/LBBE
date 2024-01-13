const mongoose = require("mongoose");

// Define the schema for the SubscriptionPlan
const subscriptionPlanSchema = new mongoose.Schema({
  name: String,
  price: Number,
  features: {
    swipeLimit: Number,
    accessToPreferences: Boolean,
    readReceipts: Boolean,
    premiumFeatures: Boolean,
    classicFeatures: Boolean,
  },
  discount: Number,
  available: Boolean,
});

// Create the SubscriptionPlan model
const Subscription = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);

module.exports = { Subscription };
