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

// Function to calculate similarity score based on user preference
const calculateSimilarity = (loggedInUser, otherUser) => {
  let score = 0;

  // Age similarity
  const ageScore = calculateAgeSimilarity(loggedInUser.age, otherUser.age);
  score += ageScore;

  // Height similarity
  const heightDiff = Math.abs(loggedInUser.height - otherUser.height);
  const heightScore = heightDiff <= 5 ? 1 : 0;
  score += heightScore;

  // Distance similarity
  const distanceDiff = Math.abs(loggedInUser.distance - otherUser.distance);
  const distanceScore = distanceDiff <= 10 ? 1 : 0;
  score += distanceScore;

  // Ethnicity similarity
  const ethnicityScore = loggedInUser.ethnicity === otherUser.ethnicity ? 1 : 0;
  score += ethnicityScore;

  // Relationship goals similarity
  const relationshipGoalsScore =
    loggedInUser.relationshipGoals === otherUser.relationshipGoals ? 1 : 0;
  score += relationshipGoalsScore;

  // Smoking similarity
  const smokingScore = loggedInUser.smoking === otherUser.smoking ? 1 : 0;
  score += smokingScore;

  // Drinking similarity
  const drinkingScore = loggedInUser.drinking === otherUser.drinking ? 1 : 0;
  score += drinkingScore;

  // Interested gender similarity
  const interestedGenderScore =
    loggedInUser.interested_gender === otherUser.gender ? 1 : 0;
  score += interestedGenderScore;

  return score;
};

export { calculateSimilarity, calculateAgeSimilarity };
