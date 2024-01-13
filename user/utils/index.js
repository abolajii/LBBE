require("dotenv").config();

const { UserActivity } = require("../../shared/model/UserActivity");
const { Report } = require("../../shared/model/Report");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Function to paginate the results
const paginateResults = (results, page, limit) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedResults = results.slice(startIndex, endIndex);

  return {
    users: paginatedResults,
    totalResults: results.length,
    currentPage: page,
    limit: limit,
  };
};

// Function to calculate age similarity score
const calculateAgeSimilarity = (loggedInUserAge, otherUserAge) => {
  const minAge1 = loggedInUserAge[0];
  const maxAge1 = loggedInUserAge[1];
  const minAge2 = otherUserAge[0];
  const maxAge2 = otherUserAge[1];

  const maxMinAgeDiff = Math.max(minAge1 - maxAge2, minAge2 - maxAge1);
  const minMaxAgeDiff = Math.min(maxAge1 - minAge2, maxAge2 - minAge1);
  const ageDiff = Math.max(0, maxMinAgeDiff, minMaxAgeDiff);

  const maxAgeDiff = maxAge1 - minAge1 + maxAge2 - minAge2;
  const ageSimilarity = 1 - ageDiff / maxAgeDiff;

  return ageSimilarity;
};

// Function to convert height in feet and inches to inches
const convertFootInchesToInches = (height) => {
  const [feet, inches] = height.split("'");
  const totalInches =
    parseInt(feet) * 12 + (inches ? parseInt(inches.replace('"', "")) : 0);
  return totalInches;
};

// Function to calculate height similarity
const calculateHeightSimilarity = (loggedInUserHeight, otherUserHeight) => {
  const loggedInUserMinInches = convertFootInchesToInches(
    loggedInUserHeight[0]
  );
  const loggedInUserMaxInches = convertFootInchesToInches(
    loggedInUserHeight[1]
  );
  const otherUserMinInches = convertFootInchesToInches(otherUserHeight[0]);
  const otherUserMaxInches = convertFootInchesToInches(otherUserHeight[1]);

  // Check if the height ranges overlap or not
  if (
    loggedInUserMinInches > otherUserMaxInches ||
    loggedInUserMaxInches < otherUserMinInches
  ) {
    return 0; // No overlap, height ranges are completely different
  }

  // Find the intersection of the height ranges
  const intersectionMin = Math.max(loggedInUserMinInches, otherUserMinInches);
  const intersectionMax = Math.min(loggedInUserMaxInches, otherUserMaxInches);

  const intersectionDiff = intersectionMax - intersectionMin;
  const heightDiff = loggedInUserMaxInches - loggedInUserMinInches;

  const heightSimilarity = intersectionDiff / heightDiff;

  return heightSimilarity;
};
// Function to calculate similarity score based on user preference
const calculateSimilarity = (loggedInUser, otherUser) => {
  const loggedInUserPreference = loggedInUser.preference;
  const otherUserPreference = otherUser.preference;
  let score = 0;

  // Age similarity
  const ageScore = calculateAgeSimilarity(
    loggedInUserPreference.age,
    otherUserPreference.age
  );
  score += ageScore;

  // Height similarity
  const heightScore = calculateHeightSimilarity(
    loggedInUserPreference.height,
    otherUserPreference.height
  );
  score += heightScore;

  // Distance similarity
  const distanceScore =
    otherUserPreference.distance <= loggedInUserPreference.distance ? 1 : 0;
  score += distanceScore;

  // Ethnicity similarity
  const ethnicityScore =
    loggedInUserPreference.ethnicity === otherUserPreference.ethnicity ? 1 : 0;
  score += ethnicityScore;

  // Religion similarity
  const religionScore =
    loggedInUserPreference.religion === otherUserPreference.religion ? 1 : 0;
  score += religionScore;

  // Relationship goals similarity
  const relationshipGoalsScore =
    loggedInUserPreference.relationshipGoals ===
    otherUserPreference.relationshipGoals
      ? 1
      : 0;
  score += relationshipGoalsScore;

  // Smoking similarity
  const smokingScore =
    loggedInUserPreference.smoking === otherUserPreference.smoking ? 1 : 0;
  score += smokingScore;

  // Education similarity
  const educationScore =
    loggedInUserPreference.education === otherUserPreference.education ? 1 : 0;
  score += educationScore;

  // Drinking similarity
  const drinkingScore =
    loggedInUserPreference.drinking === otherUserPreference.drinking ? 1 : 0;
  score += drinkingScore;

  // Kids similarity
  const kidsScore =
    loggedInUserPreference.kids === otherUserPreference.kids ? 1 : 0;
  score += kidsScore;

  // Interested gender similarity
  const interestedGenderScore =
    loggedInUserPreference.interested_gender === otherUserPreference.gender
      ? 1
      : 0;
  score += interestedGenderScore;

  const interestsScore = calculateInterestsSimilarity(
    loggedInUser.my_interests,
    otherUser.my_interests
  );

  score += interestsScore;

  return parseFloat(score.toFixed(2)); //
};

const calculateInterestsSimilarity = (
  loggedInUserInterests,
  otherUserInterests
) => {
  const commonInterests = loggedInUserInterests.filter((interest) =>
    otherUserInterests.includes(interest)
  );

  const similarity =
    commonInterests.length /
    Math.max(loggedInUserInterests.length, otherUserInterests.length);

  return similarity;
};

const updateUserActivity = async (userId, type, date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // Add 1 to the month since it's 0-based

  try {
    const filter = { userId, year, month };
    const update = {};

    if (type === "like") {
      update.$inc = { likes: 1, swipes: 1 };
    } else if (type === "swipes") {
      update.$inc = { swipes: 1 };
    } else if (type === "match") {
      update.$inc = { matches: 1 };
    }

    // Use findOneAndUpdate to find and update the document
    const activity = await UserActivity.findOneAndUpdate(filter, update, {
      new: true,
      upsert: true,
    });

    if (!activity) {
      // If the document didn't exist, create a new one
      const defaultFields = {
        userId,
        year,
        month,
        likes: 0,
        matches: 0,
        swipes: 0,
      };

      if (type === "like") {
        defaultFields.likes = 1;
        defaultFields.swipes = 1;
      } else if (type === "dislike") {
        defaultFields.swipes = 1;
      } else if (type === "match") {
        defaultFields.matches = 1;
      }

      await UserActivity.create(defaultFields);
    }

    // activity now contains the updated document
  } catch (error) {
    console.error(`Error updating activity counts:`, error);
  }
};

const generateUniqueTicketId = async () => {
  let uniqueTicketId;
  let isUnique = false;

  while (!isUnique) {
    const randomId = Math.floor(10000 + Math.random() * 90000);
    uniqueTicketId = `ID: ${randomId}`;

    // Check if the generated ticketId is unique in the database
    const existingReport = await Report.findOne({ ticketId: uniqueTicketId });

    if (!existingReport) {
      isUnique = true;
    }
  }

  return uniqueTicketId;
};

const getProductIds = async () => {
  const plans = await stripe.plans.list({ limit: 100 }); // You can adjust the limit as needed

  const productIds = {};

  for (const product of plans.data) {
    if (
      product.nickname === "Silver Plan" ||
      product.nickname === "Gold Plan" ||
      product.nickname === "Platinum Plan"
    ) {
      productIds[product.nickname] = product.id;
    }
  }

  return productIds;
};

module.exports = {
  paginateResults,
  calculateSimilarity,
  updateUserActivity,
  generateUniqueTicketId,
  getProductIds,
};
