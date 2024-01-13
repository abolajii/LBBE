require("dotenv").config();
const bcrypt = require("bcrypt");

const { logError } = require("../../shared/errorHandler");
const { User } = require("../../shared/model/User");
const { Subscription } = require("../../shared/model/Subscription");
const { Dislike } = require("../../shared/model/Dislike");
const { Match } = require("../../shared/model/Match");
const { Message } = require("../../shared/model/Message");
const { Like } = require("../../shared/model/Like");
const { UserActivity } = require("../../shared/model/UserActivity");
const { Photo } = require("../../shared/model/Photo");
const { Conversation } = require("../../shared/model/Conversation");
const { Report } = require("../../shared/model/Report");
const { Preference } = require("../../shared/model/Preference");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const { paginate } = require("../../shared/utils/paginate"); // Import the pagination function

const uploadImage = require("../utils/upload.image");
const { sendUserCreatedEmail } = require("../utils");
const { Favorite } = require("../../shared/model/Favorite");

const getDashboardDetails = async (req, res) => {
  try {
    // Count Likes, Dislikes, and Matches
    const likeCount = await Like.countDocuments();
    const dislikeCount = await Dislike.countDocuments();
    const matchCount = await Match.countDocuments();
    const favCount = await Favorite.countDocuments();

    const firstFiveUsers = await User.find()
      .sort({ createdAt: -1 })
      .populate("photos")
      .limit(5);

    // Calculate male and female counts using aggregation
    const genderCounts = await User.aggregate([
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
        },
      },
    ]);

    const maleCount =
      genderCounts.find((count) => count._id === "male")?.count || 0;
    const femaleCount =
      genderCounts.find((count) => count._id === "female")?.count || 0;

    const users = await User.find({}).populate("subscription");

    const subscribedUsers = users.filter((user) => {
      return user.subscription.name !== "Free Plan";
    });

    // Count the number of users for each subscription plan
    const subscriptionCounts = {
      "Silver Plan": 0,
      "Gold Plan": 0,
      "Platinum Plan": 0,
    };

    subscribedUsers.forEach((user) => {
      const subscriptionName = user.subscription
        ? user.subscription.name
        : null;

      if (
        subscriptionName &&
        subscriptionCounts.hasOwnProperty(subscriptionName)
      ) {
        subscriptionCounts[subscriptionName]++;
      }
    });

    const totalUsers = maleCount + femaleCount;
    const malePercentage = Math.round((maleCount / totalUsers) * 100);
    const femalePercentage = Math.round((femaleCount / totalUsers) * 100);

    const totalSubscribedUsers = subscribedUsers.length;

    res.json({
      maleCount,
      femaleCount,
      totalUsers,
      malePercentage,
      femalePercentage,
      likeCount,
      dislikeCount,
      matchCount,
      firstFiveUsers,
      subscriptionCounts,
      totalSubscribedUsers,
      favCount,
      totalItems: femaleCount + maleCount,
    });
  } catch (error) {
    logError(error); // Handle or log errors
    console.log(error);
    res.status(500).json({
      error: "An error occurred while fetching dashboard details.",
      error,
    });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Fetch all users and populate their photos
    const allUsers = await User.find()
      .populate("photos")
      .sort({ createdAt: -1 });

    const { paginationInfo, items: users } = await paginate(
      allUsers,
      page,
      limit
    );

    res.json({
      ...paginationInfo,
      users,
      length: allUsers.length,
    });
  } catch (error) {
    logError(error);
    console.log(error);
    res.status(500).json({ error: "An error occurred while fetching users." });
  }
};

const getSingleUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const user = await User.findById(userId).populate(
      "photos preferences subscription"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Count the total number of matches for the user
    const matchCount = await Match.countDocuments({ users: userId });

    // Count the total number of likes for the user
    const likeCount = await Like.countDocuments({ sender: userId });

    const favCount = await Favorite.countDocuments({ sender: userId });

    // Count the total number of dislikes for the user
    const dislikeCount = await Dislike.countDocuments({
      sender: userId,
    });

    if (user.subscription.name !== "Free Plan") {
      const subscriptionDetails = await getCustomerSubscriptionsWithCardDetails(
        user.stripeCustomerId
      );
      const cardDetails = subscriptionDetails[0];
      const userWithCardDetails = {
        user,
        cardDetails,
        matchCount,
        likeCount,
        dislikeCount,
        favCount,
      };

      return res.json(userWithCardDetails);
    }

    return res.json({ user, matchCount, likeCount, dislikeCount, favCount });
  } catch (error) {
    console.log(error);
    logError(error); // Log the error
    res
      .status(500)
      .json({ error: "An error occurred while fetching the user." });
  }
};

const getCustomerSubscriptionsWithCardDetails = async (customerId) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      expand: ["data.default_payment_method"],
    });

    return subscriptions.data;
  } catch (error) {
    throw error;
  }
};

const createAdminUser = async (req, res) => {
  const { user } = req.body;

  // Check if email or phone number already exists
  const existingUser = await User.findOne({
    $or: [{ email: user.email }, { phone: user.phone }],
  });

  if (existingUser) {
    return res
      .status(400)
      .json({ error: "Email or phone number already exists." });
  }

  const hashedPassword = await bcrypt.hash(user.password, 10);

  // Create the new user
  try {
    const newUser = new User({ ...user, password: hashedPassword });

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

    newUser.lastActive = new Date();

    // Create a Stripe customer using email as the identifier
    const stripeCustomer = await stripe.customers.create({
      email: newUser.email,
      name: newUser.name,
    });

    newUser.stripeCustomerId = stripeCustomer.id;

    await newUser.save();

    const data = {
      name: newUser.name,
      email: newUser.email,
      password: user.password,
    };

    await sendUserCreatedEmail(data);

    return res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ error: "Could not create user." });
  }
};

const updateUser = async (req, res) => {
  const userId = req.params.uid; // Assuming you pass the user ID in the URL
  const updatedUser = req.body.data; // Assuming you send the updated user data in the request body

  try {
    // Update the user with the given ID and the data from the request body
    const updatedUserData = await User.findByIdAndUpdate(userId, updatedUser, {
      new: true, // Return the updated user data
    })
      .populate("photos preferences")
      .select("-password");

    if (!updatedUserData) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .json({ message: "User updated successfully", user: updatedUserData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const upload = async (req, res) => {
  const userId = req.body.user; // Assuming you have the user ID available in the request body
  const images = req.body.photoURIs; // Assuming you have the image data available in the request body

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
      .populate("photos");

    res.status(200).json({
      message: "Uploaded successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error uploading photos: " + error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Find the user by ID and delete it
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the user" });
  }
};

const updateInterest = async (req, res) => {
  try {
    const id = req.params.id;
    const my_interests = req.body.my_interests;

    // Use findByIdAndUpdate to find and update the user by ID
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { my_interests: my_interests },
      { new: true } // This option returns the updated user
    )
      .populate("photos preferences")
      .select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Interests updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating interests" });
  }
};

const getTotalUserActivity = async (userId, year) => {
  try {
    // Fetch user activity data from the database
    const activityData = await UserActivity.find({ userId, year });

    // Create chartData object with empty arrays
    const chartData = {
      likes: [],
      matches: [],
      swipes: [],
    };

    // Initialize arrays with zeros
    chartData.likes = new Array(12).fill(0);
    chartData.matches = new Array(12).fill(0);
    chartData.swipes = new Array(12).fill(0);

    // Fill in the data from the fetched activity
    activityData.forEach((activity) => {
      const monthIndex = activity.month - 1; // Adjust month to array index
      chartData.likes[monthIndex] = activity.likes;
      chartData.matches[monthIndex] = activity.matches;
      chartData.swipes[monthIndex] = activity.swipes;
    });

    return chartData;
  } catch (error) {
    console.log("Error fetching user activity data:", error);
    return null;
  }
};

// Define a route handler to get user activity data for a specific year
const getUserActivityData = async (req, res) => {
  const { id, year } = req.params; // Assuming userId and year are passed as route parameters

  try {
    const chartData = await getTotalUserActivity(id, parseInt(year));

    if (chartData) {
      // Successfully fetched user activity data
      return res.json({ chartData });
    } else {
      return res.status(404).json({ error: "User activity data not found." });
    }
  } catch (error) {
    console.error("Error fetching user activity data:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while fetching user activity data." });
  }
};

// Retrieve all reports
const getReports = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  try {
    const allReports = await Report.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "reportedBy",
        populate: {
          path: "photos",
        },
      })
      .populate({
        path: "reportedUser",
        populate: {
          path: "photos",
        },
      });

    // Format the reports
    const _formattedReports = allReports.map((report) => ({
      ticketId: report.ticketId,
      id: report._id,
      user: {
        name: report.reportedBy ? report.reportedBy.name : "", // Add a default value if reportedBy is null
        picture: report.reportedBy
          ? report.reportedBy.photos[0]?.imageUrl
          : null,
      },
      reason: report.reason,
      reportedUser: {
        name: report.reportedUser.name,
        picture: report.reportedUser.photos[0]?.imageUrl,
      },
      date: report.createdAt,
      status: report.status || "pending",
    }));

    const count = _formattedReports.filter(
      (report) => report.status === "pending"
    ).length;

    const { paginationInfo, items: reports } = await paginate(
      _formattedReports,
      page,
      limit
    );

    res.json({
      ...paginationInfo,
      formattedReports: reports,
      count,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the reports.", error });
  }
};

const getSingleReport = async (req, res) => {
  const reportId = req.params.reportId; // Assuming you have the report ID in the request parameters

  try {
    const report = await Report.findById(reportId).populate({
      path: "reportedBy reportedUser",
      populate: {
        path: "photos", // Assuming "photos" is the field containing pictures
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const formattedReport = {
      dateCreated: report.createdAt, // You can format this date as needed
      ticketId: report.ticketId,
      status: report.status,
      reason: report.reason,

      reportedBy: {
        _id: report.reportedBy._id,
        name: report.reportedBy.name,
        gender: report.reportedBy.gender,
        email: report.reportedBy.email,
        number: report.reportedBy.phone,
        picture: report.reportedBy.photos[0].imageUrl,
      },
      reportedUser: {
        _id: report.reportedUser._id,
        name: report.reportedUser.name,
        gender: report.reportedUser.gender,
        email: report.reportedUser.email,
        number: report.reportedUser.phone,
        picture: report.reportedUser.photos[0].imageUrl,
      },
      suspended: report.suspended || false, // Assuming "suspended" is a field
    };

    res.json(formattedReport);
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the report." });
  }
};

const updateReport = async (req, res) => {
  try {
    const { reportId } = req.params; // Assuming you're passing the reportId as a route parameter

    const data = req.body.data;

    // Find the report by its ID and update the suspended field
    const report = await Report.findByIdAndUpdate(reportId, data, {
      new: true,
    }).populate({
      path: "reportedBy reportedUser",
      populate: {
        path: "photos", // Assuming "photos" is the field containing pictures
      },
    });

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const formattedReport = {
      dateCreated: report.createdAt, // You can format this date as needed
      ticketId: report.ticketId,
      status: report.status,
      reason: report.reason,
      reportedBy: {
        _id: report.reportedBy._id,
        name: report.reportedBy.name,
        gender: report.reportedBy.gender,
        email: report.reportedBy.email,
        number: report.reportedBy.phone,
        picture: report.reportedBy.photos[0].imageUrl,
      },
      reportedUser: {
        _id: report.reportedUser._id,
        name: report.reportedUser.name,
        gender: report.reportedUser.gender,
        email: report.reportedUser.email,
        number: report.reportedUser.phone,
        picture: report.reportedUser.photos[0].imageUrl,
      },
      suspended: report.suspended || false, // Assuming "suspended" is a field
    };

    res.json(formattedReport);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      error: "An error occurred while updating the suspended status",
      error,
    });
  }
};

const getConversationByParticipants = async (req, res) => {
  try {
    const { participants } = req.body; // Assuming participants is an array of user IDs

    const conversation = await Conversation.findOne({
      participants: { $all: participants },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const messages = await Message.find({
      conversation: conversation._id,
    });

    res.json({
      messages,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching conversation." });
  }
};

const searchUser = async (req, res) => {};

const updateUserCoordinates = async (req, res) => {
  const userId = req.params.userId;
  const { longitude, latitude } = req.body;

  console.log(req.body);

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the coordinates
    user.coords = {
      type: "Point",
      coordinates: [longitude, latitude],
    };

    // Save the updated user
    await user.save();

    return res
      .status(200)
      .json({ message: "Coordinates updated successfully", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const updateUserPreference = async (req, res) => {
  const userId = req.params.uid; // Assuming you have middleware that extracts the user ID from the request

  const newPreferenceData =
    {
      smoking: "All",
      gender: "Men",
      drinking: "Light weight",
      relationship_goals: "Friendship",
      kids: "Someday",
      education: "Associate",
      religion: "Agnosticism",
      ethnicity: "Asian",
      distance: 40,
      height: ["4'9\" - 8'"],
      age: [30, 40],
    } || req.body.preferences; // Assuming new preference data is sent in the request body

  try {
    // Find the user by their ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Find the user's preference and update it
    const preference = await Preference.findByIdAndUpdate(
      user.preferences,
      newPreferenceData,
      {
        new: true, // Return the updated preference
      }
    );

    if (!preference) {
      return res.status(404).json({ error: "Preference not found." });
    }

    // Populate the user and their preferences as plain JavaScript objects
    const finalUser = await User.findById(userId)
      .populate("photos preferences")
      .select("-password");

    res.json({
      message: "Preference updated successfully.",
      user: finalUser,
    });
  } catch (error) {
    console.error("Error updating preference:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating preference." });
  }
};

module.exports = {
  getAllUsers,
  getDashboardDetails,
  getSingleUser,
  createAdminUser,
  updateUser,
  upload,
  deleteUser,
  updateInterest,
  getUserActivityData,
  getReports,
  getSingleReport,
  updateReport,
  getConversationByParticipants,
  updateUserCoordinates,
  updateUserPreference,
};
