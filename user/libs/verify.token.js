const admin = require("firebase-admin");

// Verify the token and extract user information
const verifyToken = async (token) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { email, name, phone_number } = decodedToken;
    return { email, name, phone_number };
  } catch (error) {
    throw error;
  }
};

module.exports = { verifyToken };
