const bcrypt = require("bcrypt");
const { RefreshToken } = require("../../shared/model/RefreshToken");
const { Subscription } = require("../../shared/model/Subscription");
const { Preference } = require("../../shared/model/Preference");
const { Photo } = require("../../shared/model/Photo");
const { User } = require("../../shared/model/User");

const { verifyToken } = require("../libs/verify.token");

const {
  fetchUserPhotosAndSendResponse,
} = require("../utils/fetch.user.photos");
const { generateAndSendOTP } = require("../utils/generate");
const { generateAuthTokens } = require("../utils/generate.token");

const signInWithEmail = async (req, res) => {
  const { email, password } = req.body;

  const currentTime = new Date();

  try {
    // Check if the user exists with the provided email
    const user = await User.findOne({ email })
      .populate("subscription preferences photos")
      .exec(); // Use .exec() to execute the query

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Update the user's "last active" timestamp in the database
    await User.findByIdAndUpdate(user._id, { lastActive: currentTime });

    // Delete existing refresh tokens for the user
    await RefreshToken.deleteMany({ user: user._id });

    // Generate tokens
    const { refreshToken, accessToken } = generateAuthTokens(user);

    // Create a new instance of RefreshToken
    const newRefreshToken = new RefreshToken({
      token: refreshToken,
      user: user._id,
    });

    // Save the new RefreshToken instance
    await newRefreshToken.save();

    res.json({
      user,
      token: { refreshToken, accessToken },
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ error: "An error occurred during login." });
  }
};

const sigInWithOtherServices = async (req, res) => {
  try {
    const { token } = req.body;

    // Verify the token
    const { email, phone_number } = await verifyToken(token);

    if (email) {
      // User exists, sign in the user
      let user = await User.findOne({ email });
      if (user) {
        fetchUserPhotosAndSendResponse(user, res);
      } else {
        res.status(404).json({ message: "User not found. Please sign up." });
      }
    } else if (phone_number) {
      // User exists, sign in the user
      let user = await User.findOne({ phoneNumber: phone_number });
      if (user) {
        fetchUserPhotosAndSendResponse(user, res);
      } else {
        res.status(404).json({ message: "User not found. Please sign up." });
      }
    } else {
      // User does not exist, handle the registration process
      res.status(404).json({ message: "User not found. Please sign up." });
    }
  } catch (error) {
    console.log(error);
    res.status(401).json({ error: "Invalid token" });
  }
};

const verifyPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const formattedPhoneNumber = `+${phoneNumber}`;

    // Check if the phone number exists in the database
    const existingUser = await User.findOne({
      phoneNumber: formattedPhoneNumber,
    });

    if (existingUser) {
      res.status(200).json({ message: "User with phone number exists." });
    } else {
      res
        .status(400)
        .json({ message: "User with phone number does not exists." });
    }
  } catch (error) {
    res.status(500).json({ message: "Error on the server." });
  }
};

const checkEmail = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the email exists in the database
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "Email not found" });
    }

    // console.log(user);
    await generateAndSendOTP(email, user.name);

    res.status(200).json({ message: "OTP sent successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error on the server" });
  }
};

const updatePassword = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a new hash for the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update the user's password in the database
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error on the server" });
  }
};

const registerNewUser = async (req, res) => {
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
    const freePlan = await SubscriptionPlan.findOne({ name: "Free Plan" });
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

module.exports = {
  signInWithEmail,
  sigInWithOtherServices,
  verifyPhoneNumber,
  checkEmail,
  updatePassword,
  registerNewUser,
};
