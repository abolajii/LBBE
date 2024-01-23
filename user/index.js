require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 8000;
const mongoose = require("mongoose");

const admin = require("firebase-admin");

const helmet = require("helmet");
const { Subscription } = require("../shared/model/Subscription");

// TODO RATE LIMIT

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const signUpRoute = require("./routes/signup.routes");
const signInRoute = require("./routes/signin.routes");
const authRoute = require("./routes/auth.routes");

const runOTPCleanup = require("./utils/otpCleanup");
const { pusherAuth } = require("./controller/auth.controller");
const { Conversation } = require("../shared/model/Conversation");
const { Match } = require("../shared/model/Match");
const { Message } = require("../shared/model/Message");
const { Like } = require("../shared/model/Like");
const { User } = require("../shared/model/User");
const { Dislike } = require("../shared/model/Dislike");
const { Favorite } = require("../shared/model/Favorite");

const serviceAccount = {
  type: process.env.FIREBASE_SERVICE_ACCOUNT_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: privateKey,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};
const app = express();

// Run OTP cleanup task
runOTPCleanup();

app.use(helmet());

app.use(
  cors({
    origin: [
      "https://lovebirdz-391210.web.app",
      "https://lovebirdz-app.web.app",
      // "https://dobb-8c058.web.app",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

mongoose.connect(process.env.uri).then(() => {
  console.log("Connected to MongoDB!");
  // initial();

  // Define the array of subscription plans
  const subscriptionPlans = [
    {
      name: "Free Plan",
      price: 0,
      features: {
        swipeLimit: 10,
        accessToPreferences: false,
        readReceipts: false,
        premiumFeatures: false,
        classicFeatures: false,
      },
      discount: 0, // No discount for the free plan
      available: true,
    },
    {
      name: "Gold Plan",
      price: 9.99,
      features: {
        swipeLimit: Infinity,
        accessToPreferences: true,
        readReceipts: true,
        premiumFeatures: false,
        classicFeatures: false,
      },
      discount: 30, // 30% discount for the Basic plan
      available: true,
    },
    {
      name: "Silver Plan",
      price: 19.99,
      features: {
        swipeLimit: Infinity,
        accessToPreferences: true,
        readReceipts: true,
        premiumFeatures: true,
        classicFeatures: false,
      },
      discount: 30, // 30% discount for the Premium plan
      available: true,
    },
    {
      name: "Platinum Plan",
      price: 29.99,
      features: {
        swipeLimit: Infinity,
        accessToPreferences: true,
        readReceipts: true,
        premiumFeatures: true,
        classicFeatures: true,
      },
      discount: 30, // 30% discount for the Classic plan
      available: true,
    },
  ];

  //   const newPlan = new Subscription(subscriptionPlans[3]);
  //   newPlan
  //     .save()
  //     .then((savedPlan) => {
  //       console.log("New subscription plan saved:", savedPlan);
  //     })
  //     .catch((error) => {
  //       console.error("Error saving subscription plan:", error);
  //     });
  // })
  // .catch((err) => {
  //   console.log("Error connecting to MongoDB", err);
});

// // Initialize the Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// routes
app.use("/api", signUpRoute);
app.use("/api", signInRoute);
app.use("/api", authRoute);

app.post("/api/pusher/auth", pusherAuth);

const resetDb = async () => {
  const user = await User.findOne({ name: "Shade" });
  user.dob = "Jan 12, 1990";

  await user.save();

  await Conversation.deleteMany();
  await Message.deleteMany();
  await Like.deleteMany();
  await Dislike.deleteMany();
  await Favorite.deleteMany();
};

// resetDb()
//   .then(() => console.log("done"))
//   .catch((err) => console.log(err));

app.listen(port, () => {
  console.log("Server running on port", port);
});
