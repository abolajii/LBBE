require("dotenv").config();

const bcrypt = require("bcrypt");

const { User } = require("../../shared/model/User");
const { Block } = require("../../shared/model/Block");
const { Like } = require("../../shared/model/Like");
const { Dislike } = require("../../shared/model/Dislike");
const { Match } = require("../../shared/model/Match");
const { Favorite } = require("../../shared/model/Favorite");
const { Message } = require("../../shared/model/Message");
const { RefreshToken } = require("../../shared/model/RefreshToken");
const { Report } = require("../../shared/model/Report");
const { Subscription } = require("../../shared/model/Subscription");
const { Photo } = require("../../shared/model/Photo");
const { Preference } = require("../../shared/model/Preference");
const { Conversation } = require("../../shared/model/Conversation");
const { pusher } = require("../libs/pusher");

const jwt = require("jsonwebtoken");

const {
  calculateSimilarity,
  updateUserActivity,
  getProductIds,
} = require("../utils");
const { fetchUserPhotos } = require("../utils/fetch.user.photos");

const { generateUniqueTicketId } = require("../../user/utils");
const uploadImage = require("../utils/upload.image");
const { paginate } = require("../../shared/utils/paginate");
const { calculateAge } = require("../../shared/utils");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const production =
  process.env.NODE_ENV !== "production"
    ? "http://localhost:5174"
    : "https://dobb-8c058.web.app";

const getOtherUser = async (req, res) => {
  try {
    const user = await User.findById({ _id: req.params.id });
    res.status(200).json({ user });
  } catch (error) {
    console.error("Error getting user:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { page, limit } = req.query;

    // Find the logged-in user by ID
    const loggedInUser = await User.findById(loggedInUserId);

    if (!loggedInUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // // Calculate similarity in batches of 10 users
    // const batchSize = 10;
    // const userBatches = [];
    // for (let i = 0; i < filteredUsers.length; i += batchSize) {
    //   const batch = filteredUsers.slice(i, i + batchSize);
    //   const batchWithScores = await Promise.all(
    //     batch.map(async (user) => {
    //       const score = calculateSimilarity(loggedInUser, user);
    //       const photos = await fetchUserPhotos(user);
    //       const { password, ...sanitizedUser } = user;
    //       const userWithPhotos = { ...sanitizedUser, photos };
    //       return { user: userWithPhotos, score: score || 0 };
    //     })
    //   );
    //   userBatches.push(batchWithScores);
    // }

    // // Flatten the array of batches into a single array
    // const flattenedUsers = userBatches.flat();

    // // Sort the users based on their similarity scores in descending order
    // flattenedUsers.sort((a, b) => b.score - a.score);

    // console.log(loggedInUserId);
    const likedUserIds = await Like.find({ sender: loggedInUserId }).distinct(
      "receiver"
    );
    const dislikedUserIds = await Dislike.find({
      sender: loggedInUserId,
    }).distinct("receiver");

    const filteredUserIds = [
      ...likedUserIds,
      ...dislikedUserIds,
      loggedInUserId,
    ];

    const filterUsers = await User.find({ _id: { $nin: filteredUserIds } })
      .populate("photos preferences")
      .sort({ createdAt: -1 });

    const userCount = (await User.countDocuments()) || 0;

    const { paginationInfo, items: users } = await paginate(
      filterUsers,
      page,
      limit
    );

    res.json({
      ...paginationInfo,
      users,
      length: userCount,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updatePreference = async (req, res) => {
  const userId = req.user._id; // Assuming you have middleware that extracts the user ID from the request
  const newPreferenceData = req.body.preference; // Assuming new preference data is sent in the request body

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
      .populate("photos")
      .populate("subscription")
      .populate("preferences")
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

const userLikes = async (req, res) => {
  const { receiverId } = req.body;

  const senderId = req.user._id;
  // const senderId = req.body.senderId;

  const sender = await User.findById(senderId).populate("subscription photos");
  const receiver = await User.findById(receiverId).populate("photos");

  if (!sender || !receiver) {
    return res.status(400).json({ error: "No user found" });
  }

  // Check if the sender has a free plan and enough swipe limit
  if (
    sender.subscription &&
    sender.subscription.name === "Free Plan" &&
    sender.swipeLimit <= 0
  ) {
    return res.status(400).json({
      error: "No more swipe left",
    });
  }

  // If the sender has a free plan, decrement the swipe limit
  if (sender.subscription && sender.subscription.name === "Free Plan") {
    sender.swipeLimit -= 1;
    await sender.save();
  }

  try {
    // Create a new like
    const like = await Like.create({ sender: senderId, receiver: receiverId });

    await updateUserActivity(senderId, "like", new Date());

    // Trigger the "like" event for the liked user
    await pusher.trigger(`${receiverId}`, "like", {
      message: "You've received a like!",
      receiverId,
      user: {
        name: sender.name,
        img: sender.photos[0].imageUrl,
        location: "",
        age: calculateAge(sender.dob),
      },
    });

    // Check if there's a mutual like (match)
    const mutualLike = await Like.findOne({
      sender: receiverId,
      receiver: senderId,
    });

    if (mutualLike) {
      // Create a match
      const match = await Match.create({ users: [senderId, receiverId] });

      await updateUserActivity(senderId, "match", new Date());
      await updateUserActivity(receiverId, "match", new Date());

      // Create a conversation for the matched users
      const conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });

      await pusher.trigger(`${receiverId}`, "match", {
        message: "It's a match!",
        receiverId,
        conversationId: conversation._id,
        user: {
          name: sender.name,
          img: sender.photos[0].imageUrl,
        },
      });

      // Retrieve matched user's details
      const matchedUser = {
        name: receiver.name,
        firstPhoto: receiver.photos[0], // Assuming photos is an array of photo URLs
      };

      res.json({
        message: "It's a match!",
        matchId: match._id,
        conversationId: conversation._id,
        matchedUser,
      });
    } else {
      res.json({ message: "Like sent successfully.", like });
    }
  } catch (error) {
    console.error("Error creating like:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the like." });
  }
};

const userFavorites = async (req, res) => {
  try {
    const { receiverId } = req.body;

    const senderId = req.user._id;

    const sender = await User.findById(senderId).populate("photos");

    // Check if the favorite relationship already exists
    const existingFavorite = await Favorite.findOne({
      sender: senderId,
      receiver: receiverId,
    });

    if (existingFavorite) {
      return res.status(200).json({ message: "User is already favorited." });
    }

    // If the favorite relationship doesn't exist, create it (favorite)
    const fav = await Favorite.create({
      sender: senderId,
      receiver: receiverId,
    });

    await updateUserActivity(senderId, "swipes", new Date());

    // Trigger the "fav" event for the liked user
    await pusher.trigger(`${receiverId}`, "fav", {
      message: "You've received a fav!",
      receiverId,
      user: {
        name: sender.name,
        img: sender.photos[0].imageUrl,
        location: "",
        age: calculateAge(sender.dob),
      },
    });

    res.status(200).json({ message: "User favorited successfully.", fav });
  } catch (error) {
    console.error("Error handling userFavorites:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const userUnfavorites = async (req, res) => {
  try {
    const { loggedInUserId, favoriteUserId } = req.body;

    // Check if the favorite relationship exists
    const existingFavorite = await Favorite.findOne({
      loggedInUserId,
      favoriteUserId,
    });

    if (!existingFavorite) {
      return res.status(200).json({ message: "User is not favorited." });
    }

    // If the favorite relationship exists, remove it (unfavorite)
    await Favorite.findOneAndDelete({
      loggedInUserId,
      favoriteUserId,
    });

    res.status(200).json({ message: "User unfavorited successfully." });
  } catch (error) {
    console.error("Error handling userUnfavorites:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const userDislikes = async (req, res) => {
  const senderId = req.user._id;

  try {
    const { receiverId } = req.body;

    const existingDislike = await Dislike.findOne({
      sender: senderId,
      receiver: receiverId,
    });

    if (existingDislike) {
      return res.status(200).json({ message: "User is already disliked." });
    }

    // Check if the favorite relationship exists, and if so, remove it (since we are disliking the user now)
    await Favorite.findOneAndDelete({ sender: senderId, receiver: receiverId });

    // If the dislike relationship doesn't exist, create it (dislike)
    const dislike = await Dislike.create({
      sender: senderId,
      receiver: receiverId,
    });

    await updateUserActivity(senderId, "swipes", new Date());

    res.status(200).json({ message: "User disliked successfully.", dislike });
  } catch (error) {
    console.log(error);
    console.log("Error handling userDislikes:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const isBlocked = async (userId, blockedUserId) => {
  try {
    // Query your database or data store to check if userId is blocked by blockedUserId
    const senderBlocked = await Block.findOne({
      user: userId,
      blockedUserId,
    });

    const receiverBlocked = await Block.findOne({
      user: blockedUserId,
      blockedUserId: userId,
    });

    return {
      senderBlocked: !!senderBlocked,
      receiverBlocked: !!receiverBlocked,
    };
  } catch (error) {
    console.error("Error checking if user is blocked:", error);
    throw error; // You may handle the error according to your application's error handling strategy
  }
};

const sendMessage = async (req, res) => {
  const userId = req.user._id;

  const conversationId = req.params.conversationId;
  const { content, senderId } = req.body;

  try {
    // Find the conversation
    const conversation = await Conversation.findById(conversationId).populate(
      "participants messages"
    );

    // Check if the sender has blocked the receiver
    const senderBlockedReceiver = await isBlocked(
      senderId,
      conversation.participants.find((id) => id._id.toString() !== senderId)._id
    );

    if (senderBlockedReceiver.senderBlocked) {
      // The sender has blocked the receiver
      return res.status(403).json({
        error: `You blocked ${
          conversation.participants.find((id) => id._id.toString() !== senderId)
            .name
        }. Message not sent.`,
      });
    } else if (senderBlockedReceiver.receiverBlocked) {
      return res.status(403).json({
        error: `${
          conversation.participants.find((id) => id._id.toString() !== senderId)
            .name
        } blocked you. Message not sent.`,
      });
    }

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // Create a new message
    const newMessage = await new Message({
      conversation: conversationId,
      sender: senderId,
      content: content,
      seenBy: [senderId],
    });

    // Save the message
    await newMessage.save();

    // Update the conversation's lastMessage and messages array
    conversation.lastMessage = newMessage._id;
    conversation.messages.push(newMessage._id);

    await conversation.save();

    await pusher.trigger(conversationId, "messages:new", newMessage);

    const id = conversation.participants.find(
      (user) => user._id.toString() !== userId.toString()
    )._id;

    const unreadCount = conversation.messages.reduce((count, message) => {
      // Check if the current user has not seen the message
      if (!message.seenBy.includes(id)) {
        count++;
      }
      return count;
    }, 0);

    conversation.participants.map((user) => {
      pusher.trigger(`${user._id.toString()}`, "conversation:update", {
        id: conversationId,
        messages: [newMessage],
        unreadCount,
      });
    });

    res.json({ message: "Message sent successfully.", newMessage });
  } catch (error) {
    console.error("Error sending message:", error);
    res
      .status(500)
      .json({ error: "An error occurred while sending the message." });
  }
};

const markMessageAsSeen = async (req, res) => {
  const { conversationId } = req.params;
  const user = req.user._id;

  try {
    const conversation = await Conversation.findById(conversationId).populate(
      "messages"
    ); // Populate the messages field
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    if (conversation.messages.length < 0) {
      return res.status(201).json({ msg: "No message avaliable" });
    }

    let lastMessage = conversation.messages[conversation.messages.length - 1];

    if (lastMessage.seenBy.includes(user)) {
      return res.status(201).json({ msg: "Already seen by you" });
    }

    // Update all messages in the conversation as seen by the receiver
    await Message.updateMany(
      { _id: { $in: conversation.messages.map((msg) => msg._id) } },
      { $addToSet: { seenBy: user } }
    );

    const updatedConversation = await Conversation.findById(
      conversationId
    ).populate("messages");

    const lastSeenMessage =
      updatedConversation.messages[conversation.messages.length - 1];

    if (lastSeenMessage) {
      // Trigger the Pusher event with the last seen message
      await pusher.trigger(`${user.toString()}`, "conversation:update", {
        id: conversation._id,
        messages: [lastSeenMessage],
      });

      await pusher.trigger(conversationId, "message:update", lastSeenMessage);
    }

    res.json({
      message: "All messages in the conversation are marked as seen.",
      conversation,
    });
  } catch (error) {
    console.error("Error marking conversation as seen:", error);
    res.status(500).json({
      error: "An error occurred while marking the conversation as seen.",
    });
  }
};

const getAllConversations = async (req, res) => {
  try {
    const { c } = req.params;

    // Fetch all conversations where the user is a part of
    const conversations = await Conversation.find({
      userIds: c,
    })
      .populate("userIds")
      .populate("messages")
      .sort({ lastMessageAt: -1 });

    // Fetch user photos for each conversation
    const conversationsWithPhotos = await Promise.all(
      conversations.map(async (conversation) => {
        const usersWithPhotos = await Promise.all(
          conversation.userIds.map(async (user) => {
            const userWithPhotos = { ...user._doc };
            const photoUrls = await fetchUserPhotos(user);
            userWithPhotos.photos = photoUrls;
            return userWithPhotos;
          })
        );

        return { ...conversation._doc, userIds: usersWithPhotos };
      })
    );

    res.status(200).json(conversationsWithPhotos);
  } catch (error) {
    console.error("Error getting all conversations:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const getMessagesBetweenUsers = async (req, res) => {
  try {
    const { loggedInUserId, userId } = req.params;

    // Fetch all messages between user1 and user2
    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId, receiverId: userId },
        { senderId: userId, receiverId: loggedInUserId },
      ],
    });

    // Send the response with all messages and their seen status
    res.status(200).json({ messages });
  } catch (error) {
    console.error("Error getting messages between users:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const logOut = async (req, res) => {
  const refreshToken = req.body.refreshToken;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token not provided." });
  }

  try {
    // Delete the refresh token from the database
    await RefreshToken.findOneAndDelete({ token: refreshToken });

    res.status(200).json({ message: "Logout successful." });
  } catch (error) {
    console.error("Error logging out:", error);
    res.status(500).json({ error: "An error occurred while logging out." });
  }
};

const updateUser = async (req, res) => {
  try {
    // Get the user ID from the request or your authentication middleware
    const userId = req.user._id; // You may need to replace this with your actual user ID retrieval logic

    // Get the updated user profile data from the request body
    const updatedProfile = req.body;

    // Validate the updatedProfile data, e.g., check for required fields
    if (!updatedProfile) {
      return res.status(400).json({ message: "Profile data is required" });
    }

    // You can update the user's profile in your database here
    const user = await User.findByIdAndUpdate(userId, updatedProfile, {
      new: true,
    }).populate("subscription photos preferences");

    // Return the updated user profile as a response
    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const uploadPicture = async (req, res) => {
  const userId = req.user._id; // Assuming you have the user ID available in the request body
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
      .populate("photos preferences subscription");

    res.status(200).json({
      message: "Uploaded successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error uploading photos: " + error);
  }
};

const getAllSubs = async (req, res) => {
  const productIds = await getProductIds();
  const allSubs = await Subscription.find();

  // Attach product IDs to each subscription plan
  const subsWithProductIds = allSubs.map((sub) => ({
    ...sub.toObject(),
    priceId: productIds[sub.name], // Assuming 'name' in your model matches the nickname in Stripe
  }));

  res.json({ subscriptionPlans: subsWithProductIds });
};

const sessionCheck = async (req, res) => {
  // Fetch the plan details from Stripe based on the priceId
  const priceId = req.body.priceId;
  let plan;

  try {
    plan = await stripe.prices.retrieve(priceId);
  } catch (error) {
    // Handle any errors when fetching the plan
    console.error("Error fetching plan from Stripe:", error);
    return res.status(500).json({ error: "Error fetching plan from Stripe" });
  }

  // Now, you have the plan details, including the name
  const planName = plan.nickname;

  const id = req.user._id;
  const user = await User.findById(id);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: req.body.priceId,
        quantity: 1,
      },
    ],
    success_url: `${production}/success?plan=${encodeURIComponent(planName)}`,
    cancel_url: `${production}/failure`,
    customer: user.stripeCustomerId,
  });

  res.json(session);
};

const getUserSubscriptionStatus = async (customerId, plan) => {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active", // You can specify 'active', 'trialing', 'past_due', or 'all'
    });
    const isUpgraded = subscriptions.data.some(
      (sub) => sub.plan.nickname === plan
    );

    return { isUpgraded };
  } catch (error) {
    console.error(error);
    return {
      error: "An error occurred while checking the subscription status.",
    };
  }
};

const assignSubscriptionPlan = async (userId, subscriptionPlanName) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      return { error: "User not found" };
    }

    // Find the plan subscription in the database
    const plan = await Subscription.findOne({ name: subscriptionPlanName });

    // Assign the subscription to the user
    user.subscription = plan;

    await (await user.save()).populate("subscription photos preferences");

    return { success: "Subscription plan assigned successfully", user };
  } catch (error) {
    console.error(error);
    return {
      error: "An error occurred while assigning the subscription plan.",
    };
  }
};

const userStatus = async (req, res) => {
  const { stripeCustomerId } = req.user; // Get the customer ID from the query parameter or token
  const userId = req.user._id;
  const { plan } = req.params;

  if (!stripeCustomerId) {
    return res.status(400).json({ error: "Customer ID is required." });
  }
  try {
    const { isUpgraded, error: statusCheckError } =
      await getUserSubscriptionStatus(stripeCustomerId, plan);

    if (statusCheckError) {
      return res.status(500).json({ error: statusCheckError });
    }

    if (isUpgraded) {
      const {
        error: assignError,
        success,
        user,
      } = await assignSubscriptionPlan(userId, plan);

      if (assignError) {
        return res.status(500).json({ error: assignError });
      }

      return res.json({ message: success, user });
    }

    return res.json({ message: "User is not upgraded to the specified plan." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  }
};

const getConversationsForUser = async (req, res) => {
  const loggedInUserId = req.user._id;

  try {
    const conversations = await Conversation.find({
      participants: loggedInUserId,
    })
      .populate({
        path: "participants",
        select: "name photos",
        populate: { path: "photos" },
      })
      .populate("lastMessage", "content timestamp seenBy sender")
      .populate("messages")
      .sort({ updatedAt: -1 })
      .exec();

    // Calculate unread count for each conversation
    const conversationsWithUnreadCount = conversations.map((conversation) => {
      const unreadCount = conversation.messages.reduce((count, message) => {
        if (!message.seenBy.includes(loggedInUserId)) {
          count++;
        }
        return count;
      }, 0);

      return {
        ...conversation.toObject(),
        unreadCount,
      };
    });

    res.json({ conversations: conversationsWithUnreadCount });
  } catch (error) {
    console.error("Error getting conversations:", error);
    res
      .status(500)
      .json({ error: "An error occurred while getting conversations." });
  }
};

const getConversationById = async (req, res) => {
  const conversationId = req.params.conversationId;

  try {
    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name")
      .populate({
        path: "messages",
        populate: {
          path: "sender",
          select: "name",
        },
      })
      .exec();

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    res.json({ conversation });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({
      error: "An error occurred while getting the conversation.",
    });
  }
};

const getAllMessagesInConversation = async (req, res) => {
  const { conversationId } = req.params;

  try {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const messages = await Message.find({
      conversation: conversationId,
    });

    res.json({
      messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching messages." });
  }
};

const getUserInConvo = async (req, res) => {
  try {
    const loggedInUserId = req.user._id; // Assuming you're extracting the user ID from the token
    const targetUserId = req.params.uid;

    // Find the conversation where both logged-in user and target user are participants
    const conversation = await Conversation.findOne({
      participants: { $all: [loggedInUserId, targetUserId] },
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    // Find the user with the specified uid
    const user = await User.findById(targetUserId).populate(
      "subscription photos preferences"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error getting conversation or user:", error);
    res.status(500).json({
      error: "An error occurred while getting the conversation or user.",
    });
  }
};

const pusherAuth = async (req, res) => {
  const token = req.query.access_token;
  const socketId = req.body.socket_id;
  const channel = req.body.channel_name;

  try {
    if (token === null) {
      // console.log(token, "null");
      return res.status(403).json({ error: "Access token not provided" });
    }
    if (token !== null) {
      // console.log(token, "not null");
      const decoded = await jwt.verify(
        token,
        process.env.MY_AUTH_TOKEN_SECRET_KEY
      ); // Change to your JWT secret

      const data = {
        user_id: decoded.userId,
      };

      const authResponse = pusher.authorizeChannel(socketId, channel, data);
      return res.send(authResponse);
    }
  } catch (error) {
    console.log(error);
  }
};

const blockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const userId = req.user._id;

    // Check if the user to be blocked exists
    const blockedUser = await User.findById(blockedUserId);

    if (!blockedUser) {
      return res.status(404).json({ message: "Blocked user not found" });
    }

    // Check if there is an existing block document
    const existingBlock = await Block.findOne({ user: userId, blockedUserId });

    if (existingBlock) {
      return res.status(400).json({ message: "User already blocked" });
    }

    // Create a new Block document to represent the block
    const block = new Block({ user: userId, blockedUserId });

    // Save the block document
    await block.save();

    // Update the user's photos array with the uploaded photo IDs
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $push: { blockedUsers: block._id } }, // Push the blockedUserId to the blockedUsers array
      { new: true }
    )
      .populate("subscription photos preferences blockedUsers")
      .exec();

    res.json({ message: "User blocked successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const unblockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const userId = req.user._id;

    // Check if the user to be unblocked exists
    const blockedUser = await User.findById(blockedUserId);

    if (!blockedUser) {
      return res.status(404).json({ message: "Blocked user not found" });
    }

    // Check if there is an existing block document
    const existingBlock = await Block.findOne({ user: userId, blockedUserId });

    if (!existingBlock) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    // Delete the block document to unblock the user
    await Block.deleteOne({ user: userId, blockedUserId });

    // Find the user and populate fields (including blockedUsers)
    const user = await User.findById(userId)
      .populate("subscription photos preferences")
      .exec();

    res.json({ message: "User unblocked successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const reportUser = async (req, res) => {
  try {
    const { reportedUser, reason } = req.body;
    const reportedBy = req.user._id;
    const ticketId = await generateUniqueTicketId();

    // Fetch the user details
    const reportedByUser = await User.findById(reportedBy);
    const reportedUserUser = await User.findById(reportedUser);

    // Check if users were found
    if (!reportedByUser || !reportedUserUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create the report
    const report = new Report({
      reportedBy: reportedByUser._id,
      reportedUser: reportedUserUser._id,
      reason: reason,
      ticketId: ticketId,
      suspsended: false,
    });

    await report.save();

    res.status(201).json(report);
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "An error occurred while creating the report.",
      error,
    });
  }
};

const updateCoordinates = async (req, res) => {
  try {
    // Get the user ID from the request or your authentication middleware
    const userId = req.user._id; // You may need to replace this with your actual user ID retrieval logic
    const newCoordinates = [
      parseFloat(req.body.longitude),
      parseFloat(req.body.latitude),
    ]; // Get the new coordinates from the request body

    // Find the user by ID and update the coordinates
    const user = await User.findByIdAndUpdate(
      userId,
      {
        coords: { type: "Point", coordinates: newCoordinates },
      },
      { new: true }
    ).populate("subscription photos preferences");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res
      .status(200)
      .json({ message: "User coordinates updated successfully", user });
  } catch (error) {
    console.error("Error updating user coordinates:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const filterUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user._id; // Assuming you have user information in req.user

    const maxDistanceInMiles = req.body.distance; // Maximum distance in miles
    const maxDistanceInMeters = maxDistanceInMiles * 1609.34; // Convert to meters

    // Ensure that the maxDistance is non-negative
    if (maxDistanceInMeters < 0) {
      return res
        .status(400)
        .json({ message: "Max distance must be non-negative." });
    }

    // Extract age range from req.body if it exists
    const age = req.body.age;
    const minAge = age && age[0];
    const maxAge = age && age[1];

    // Extract gender from req.body
    const gender = req.body.gender;

    // Ensure that the logged-in user's coordinates exist
    const loggedInUser = await User.findById(loggedInUserId);

    if (
      !loggedInUser ||
      !loggedInUser.coords ||
      !loggedInUser.coords.coordinates
    ) {
      return res
        .status(400)
        .json({ message: "Logged-in user has no location information." });
    }

    const { coordinates } = loggedInUser.coords;

    // Define the aggregation pipeline
    const pipeline = [];

    if (maxDistanceInMeters >= 0) {
      pipeline.push({
        $geoNear: {
          near: {
            type: "Point",
            coordinates: coordinates,
          },
          distanceField: "distance",
          maxDistance: maxDistanceInMeters,
          spherical: true,
          query: {
            _id: { $ne: loggedInUserId }, // Exclude the logged-in user
            "coords.coordinates": { $exists: true }, // Filter users with coordinates
          },
        },
      });
    }

    if (minAge && maxAge) {
      // Calculate the age range based on the current date
      const currentYear = new Date().getFullYear();
      const minBirthYear = currentYear - maxAge;
      const maxBirthYear = currentYear - minAge;

      pipeline.push({
        $addFields: {
          dobParts: { $split: ["$dob", "-"] }, // Split the 'dob' into parts
        },
      });

      pipeline.push({
        $addFields: {
          birthYear: { $toInt: { $arrayElemAt: ["$dobParts", 2] } }, // Extract the year and convert to integer
        },
      });

      pipeline.push({
        $match: {
          birthYear: { $gte: minBirthYear, $lte: maxBirthYear },
        },
      });
    }

    if (gender) {
      // Filter by gender
      pipeline.push({
        $match: {
          gender: gender,
        },
      });
    }

    // Add a $project stage to define which fields you want to include
    pipeline.push({
      $project: {
        dobParts: 0,
        birthYear: 0,
      },
    });

    const users = await User.aggregate(pipeline);

    // Extract user IDs for the users in the result
    const userIds = users
      .filter((user) => user._id.toString() !== loggedInUserId.toString()) // Exclude the logged-in user
      .map((user) => user._id);

    // Query the User model to populate the subscription and photos fields
    const populatedUsers = await User.find({ _id: { $in: userIds } }).populate(
      "subscription photos preferences"
    );

    // Merge the populated user data with the filtered user data
    const mergedUsers = users
      .filter((user) => user._id.toString() !== loggedInUserId.toString()) // Exclude the logged-in user
      .map((user) => {
        const matchingUser = populatedUsers.find(
          (u) => u._id.toString() === user._id.toString()
        );
        return {
          ...user,
          subscription: matchingUser.subscription,
          photos: matchingUser.photos,
        };
      });

    res.json({ users: mergedUsers });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error while filtering users." });
  }
};

const updatePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user._id; // Assuming you have user information in req.user

  try {
    // Find the user by ID
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare the old password with the hashed password stored in the database
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password with the new hashed password
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Error updating password" });
  }
};

const deleteUserPicture = async (req, res) => {
  const userId = req.user._id; // Assuming you have user information in req.user
  const { photoId } = req.params;

  try {
    // Find the user by their ID and populate the photos field
    const user = await User.findById(userId).populate(
      "subscription photos preferences"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find the photo by its ID in the user's photos array
    const photo = user.photos.find((photo) => photo._id.toString() === photoId);

    if (!photo) {
      return res.status(404).json({ message: "Photo not found" });
    }

    // Remove the photo from the user's photos array
    user.photos.pull(photo);

    // Save the updated user without the deleted photo
    await user.save();

    res.status(200).json({ message: "Photo deleted successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUserLikesAndFav = async (req, res) => {
  const userId = req.user._id; // Assuming you're using some form of authentication middleware

  try {
    // Get user's likes
    const likes = await Like.find({ receiver: userId }).sort({
      createdAt: -1,
    });

    // Get user's favorites
    const favorites = await Favorite.find({ receiver: userId })
      .populate("sender")
      .sort({
        createdAt: -1,
      });

    const likesId = likes.map((like) => like.sender);
    const favId = favorites.map((fav) => fav.sender);

    const likeUsers = await User.find({ _id: { $in: likesId } }).populate(
      "photos"
    );

    const favUsers = await User.find({ _id: { $in: favId } }).populate(
      "photos"
    );

    // Get all matches for the logged-in user
    const userMatches = await Match.find({ users: userId }).populate("users");

    const matchedUserIds = userMatches
      .flatMap((match) => match.users.map((user) => user._id.toString()))
      .filter((id) => id !== userId.toString());

    // Filter out users who have already matched with the logged-in user
    const unmatchedLikeUsers = likeUsers.filter(
      (user) => !matchedUserIds.includes(user._id.toString())
    );

    const unmatchedFavUsers = favUsers.filter(
      (user) => !matchedUserIds.includes(user._id.toString())
    );

    // Format the likes and favorites array to the specified format
    const formattedLikes = unmatchedLikeUsers.map((user) => {
      return {
        _id: user._id,
        name: user.name,
        img: user.photos[0].imageUrl,
        location: "",
        age: calculateAge(user.dob),
      };
    });

    const formattedFavorites = unmatchedFavUsers.map((user) => {
      return {
        _id: user._id,
        name: user.name,
        img: user.photos[0].imageUrl,
        location: "",
        age: calculateAge(user.dob),
      };
    });

    res.json({ likes: formattedLikes, favorites: formattedFavorites });
  } catch (error) {
    console.error("Error fetching user's likes and favorites:", error);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
};

module.exports = {
  getOtherUser,
  getAllUsers,
  blockUser,
  updatePreference,
  unblockUser,
  userLikes,
  userFavorites,
  userUnfavorites,
  userDislikes,
  sendMessage,
  reportUser,
  markMessageAsSeen,
  getAllMessagesInConversation,
  getAllConversations,
  getMessagesBetweenUsers,
  logOut,
  updateUser,
  uploadPicture,
  getAllSubs,
  sessionCheck,
  userStatus,
  getConversationsForUser,
  getConversationById,
  getAllMessagesInConversation,
  pusherAuth,
  getUserInConvo,
  updateCoordinates,
  filterUsers,
  updatePassword,
  deleteUserPicture,
  getUserLikesAndFav,
};
