require("dotenv").config();
const nodemailer = require("nodemailer");

const ejs = require("ejs");
const path = require("path");

const { Subscription } = require("../../shared/model/Subscription");
const { UserActivity } = require("../../shared/model/UserActivity");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY); // Import the Stripe library

const user = process.env.user;
const host = process.env.host;
const pass = process.env.pass;

const transport = nodemailer.createTransport({
  host,
  port: 465,
  secure: true,
  debug: true,
  logger: true,
  auth: {
    user,
    pass,
  },
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: false,
  },
});

const updateLocalSubscription = async (subscriptionId, updateData) => {
  try {
    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscriptionId,
      updateData,
      { new: true } // Return the updated subscription
    );
    return updatedSubscription;
  } catch (error) {
    throw error;
  }
};

const updateStripeSubscription = async (
  stripeProductId,
  stripePriceId,
  updateData
) => {
  const { name, price, available, features } = updateData;

  try {
    // Update the product on Stripe
    if (name !== "" || features !== undefined) {
      await stripe.products.update(stripeProductId, {
        name: name,
        metadata: {
          features: JSON.stringify(features),
        },
      });
    }
    if (price !== undefined) {
      const priceInCents = Number(price) * 100;

      // Update the price on Stripe
      await stripe.products.update(stripeProductId, {
        unit_amount: priceInCents, // Convert and round price to cents
      });
    }

    // Update the availability on Stripe if included
    if (available !== undefined) {
      await stripe.products.update(stripeProductId, {
        active: available,
      });
    }
  } catch (error) {
    throw error;
  }
};

const updateUserActivity = async (userId, actionType, date) => {
  try {
    // Get the year and month from the provided date
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1; // Add 1 to the month since it's 0-based

    // Define the field to update based on the action type
    let updateField;
    if (actionType === "like") {
      updateField = "likes";
    } else if (actionType === "match") {
      updateField = "matches";
    } else if (actionType === "swipe") {
      updateField = "swipes";
    } else {
      // Invalid action type
      return;
    }

    // Find the user activity document for the specified user, year, and month
    const activity = await UserActivity.findOne({ userId, year, month });

    if (activity) {
      // Increment the specified count field
      activity[updateField] += 1;
    } else {
      // If the activity document doesn't exist, create a new one
      const newActivity = {
        userId,
        year,
        month,
      };
      newActivity[updateField] = 1;
      await UserActivity.create(newActivity);
    }

    // Save the changes
    await activity.save();
  } catch (error) {
    console.error(`Error updating ${actionType} count:`, error);
  }
};

// Load the EJS template
const templatePath = path.join(__dirname, "../templates", "user.creation.ejs");

// Function to send the email
const sendUserCreatedEmail = async (user) => {
  const from = process.env.user;

  const emailData = {
    from,
    to: user?.email,
    subject: "Welcome to LoveBirdz",
  };

  // Render the EJS template
  ejs.renderFile(templatePath, { user }, (err, data) => {
    if (err) {
      console.log("EJS rendering error: ", err);
    } else {
      // Email content
      emailData.html = data;

      transport.sendMail(emailData, (error, info) => {
        if (error) {
          console.log("Email sending error: ", error);
        } else {
          console.log("Email sent: ", info.response);
        }
      });
    }
  });
};

module.exports = {
  updateStripeSubscription,
  updateLocalSubscription,
  updateUserActivity,
  sendUserCreatedEmail,
};
