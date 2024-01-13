const { Photo } = require("../../shared/model/Photo");
const { generateAuthTokens } = require("./generate.token");

const fetchUserPhotosAndSendResponse = async (user, res) => {
  // Fetch the photos associated with the user
  const photosToAdd = await Photo.find({ user: user._id });

  // Assign the fetched photos to the user object
  user.photos = photosToAdd;

  const photoToSend = user.photos.map((photo) => photo.imageUrl);
  const { photos, password, ...userDetails } = user.toObject();

  // Generate authentication tokens
  const { authToken } = generateAuthTokens(user);

  // Attach the authToken to the response header
  res.setHeader("Authorization", `Bearer ${authToken}`);

  res.status(200).json({
    message: "Authentication successful",
    user: { photos: photoToSend, ...userDetails },
  });
};

const fetchUserPhotos = async (user) => {
  // Fetch the photos associated with the user
  const photosToAdd = await Photo.find({ user: user._id });

  // Assign the fetched photos to the user object
  user.photos = photosToAdd;

  // Extract and return the photo URLs for the user
  return user.photos.map((photo) => photo.imageUrl);
};
module.exports = { fetchUserPhotosAndSendResponse, fetchUserPhotos };
