const bcrypt = require("bcrypt");
const { User } = require("../../shared/model/User");
const { Photo } = require("../../shared/model/Photo");
const { RefreshToken } = require("../../shared/model/RefreshToken");
const uploadImage = require("../utils/upload.image");
const { generateAuthTokens } = require("../utils/generate.token");
const { verifyToken } = require("../libs/verify.token");
const { generateAndSendOTP, verifyOTP } = require("../utils/generate");
const { Block } = require("../../shared/model/Block");
const { Subscription } = require("../../shared/model/Subscription");
const { Preference } = require("../../shared/model/Preference");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const createLogger = require("../utils/logger");

const logger = createLogger("error.log");

const checkDuplicateEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if an existing user with the same email exists
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (existingUser) {
      res.status(400).json({ message: "User with email already exists." });
    } else {
      await generateAndSendOTP(email);

      res.status(200).json({ message: "OTP sent successfully." });
    }
  } catch (error) {
    logger.error("Error occurred:", error);
    res.status(500).json({ message: "Error on the server." });
  }
};

const checkDuplicatePhoneNumber = async (req, res) => {
  try {
    const { phone } = req.body;

    // Check if the phone number already exists in the database
    const existingUser = await User.findOne({
      phone,
    });

    if (existingUser) {
      // User with the phone number already exists
      res
        .status(400)
        .json({ message: "User with phone number already exists." });
    } else {
      // Phone number is unique
      res.status(200).json({ message: "Phone number is available." });
    }
  } catch (error) {
    logger.error("Error occurred:", error);
    res.status(500).json({ message: "Error on the server." });
  }
};

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      dob,
      my_interests,
      gender,
      interested_gender,
      phone,
    } = req.body;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      name,
      password: hashedPassword,
      email,
      my_interests,
      gender,
      interested_gender,
      dob,
      phone,
    });

    // Find the "Free Plan" subscription in the database
    const freePlan = await Subscription.findOne({ name: "Free Plan" });
    // Assign the subscription to the user
    newUser.subscription = freePlan;
    newUser.swipeLimit = freePlan.features.swipeLimit;

    // Create a new Preference instance
    const newPreference = new Preference({
      user: newUser._id,
    });

    // Save the new Preference instance
    await newPreference.save();

    // Update the user's preference reference
    newUser.preferences = newPreference._id;

    // Create a Stripe customer using email as the identifier
    const stripeCustomer = await stripe.customers.create({
      email: newUser.email,
      name: newUser.name,
    });

    newUser.stripeCustomerId = stripeCustomer.id;

    await newUser.save();

    res.status(201).json({
      message: "User registered successfully.",
      user: newUser,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while registering user.", error });
  }
};

const registerUserWithOtherServices = async (req, res) => {
  const { name, email, dob, my_interests, interested_gender, gender, phone } =
    req.body;
  const userId = req.body.id;

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        name,
        email,
        gender,
        dob,
        my_interests,
        interested_gender,
        phone,
      },
      { new: true }
    );

    if (updatedUser) {
      // Find the "Free Plan" subscription in the database
      const freePlan = await Subscription.findOne({ name: "Free Plan" });
      // Assign the subscription to the user
      updatedUser.subscription = freePlan;
      updatedUser.swipeLimit = freePlan.features.swipeLimit;

      // Create a new Preference instance
      const newPreference = new Preference({
        user: updatedUser._id,
      });

      // Save the new Preference instance
      await newPreference.save();

      // Update the user's preference reference
      updatedUser.preferences = newPreference._id;

      // Create a Stripe customer using email as the identifier
      const stripeCustomer = await stripe.customers.create({
        email: updatedUser?.email,
        name: updatedUser.name,
      });

      updatedUser.stripeCustomerId = stripeCustomer.id;

      await updatedUser.save();

      res
        .status(200)
        .json({ message: "User updated successfully", user: updatedUser });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    logger.error("Error occurred:", error);
    res.status(500).json({ message: "Error on the server" });
  }
};

const upload = async (req, res) => {
  const userId = req.body.user; // Assuming you have the user ID available in the request body
  const images = req.body.photoURIs; // Assuming you have the image data available in the request body

  const currentTime = new Date();

  try {
    // Save the photos to the database or file storage system
    const photoPromises = images.map(async (url) => {
      const imageUrl = await uploadImage(url);
      // Create a new photo
      const newPhoto = new Photo({
        user: userId,
        imageUrl,
      });
      // Save the photo to the database
      await newPhoto.save();
      return newPhoto._id;
    });

    // Wait for all photo uploads to complete
    const photoIds = await Promise.all(photoPromises);

    // Update the user's photos array with the uploaded photo IDs
    const user = await User.findByIdAndUpdate(
      userId,
      { $push: { photos: { $each: photoIds } } },
      { new: true }
    )
      .select("-password")
      .populate("subscription photos preferences");
    // Generate tokens
    const { refreshToken, accessToken } = generateAuthTokens(user);

    // Create a new instance of RefreshToken
    const newRefreshToken = new RefreshToken({
      token: refreshToken,
      user: user._id,
    });

    // Update the user's "last active" timestamp in the database
    await User.findByIdAndUpdate(userId, { lastActive: currentTime });

    // Save the new RefreshToken instance
    await newRefreshToken.save();

    res.status(200).json({
      message: "Uploaded successfully",
      user,
      token: { refreshToken, accessToken },
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error uploading photos: " + error);
  }
};

const verifyOtherServices = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify the token
    const { email, name, phone_number } = await verifyToken(token);

    if (email) {
      // Check if the user exists in the database by email
      const userByEmail = await User.findOne({ email });

      if (userByEmail) {
        // User already exists, prompt them to sign in
        res
          .status(409)
          .json({ message: "User already exists. Please sign in." });
      } else {
        // Create a new user in the database with the necessary details
        const newUser = new User({
          name,
          email,
        });

        // Save the new user to the database
        const createdUser = await newUser.save();

        // Send a success response
        res.status(200).json({
          message: "New user created successfully",
          user: createdUser,
        });
      }
    } else if (phone_number) {
      // Check if the user exists in the database by phoneNumber
      const userByPhoneNumber = await User.findOne({
        phone: phone_number,
      });

      if (userByPhoneNumber) {
        // User already exists, prompt them to sign in
        res
          .status(409)
          .json({ message: "User already exists. Please sign in." });
      } else {
        // Create a new user in the database with the necessary details
        const newUser = new User({
          phone: phone_number,
        });

        // Save the new user to the database
        const createdUser = await newUser.save();

        // Send a success response
        res.status(200).json({
          message: "New user created successfully",
          user: createdUser,
        });
      }
    } else {
      // Invalid token without email or phoneNumber
      res
        .status(400)
        .json({ error: "Invalid token. Please provide valid credentials." });
    }
  } catch (error) {
    logger.error("Error occurred:", error);
    // Token verification failed, send an error response
    res.status(401).json({ error: "Invalid token" });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    await verifyOTP(email, otp);

    res.status(200).json({ message: "OTP verification successful.", email });
  } catch (error) {
    logger.error("Error occurred:", error);
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  checkDuplicateEmail,
  registerUser,
  upload,
  verifyOtherServices,
  verifyOtp,
  checkDuplicatePhoneNumber,
  registerUserWithOtherServices,
};
