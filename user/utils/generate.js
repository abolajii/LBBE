const { OTP } = require("../../shared/model/Otp");
const nodemailer = require("../config/nodemailer.config");

const generateOtp = (num = 4) => {
  let otp = "";
  for (let i = 0; i < num; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
};

const generateAndSendOTP = async (email, name) => {
  const otp = generateOtp(6);
  const expirationTime = new Date().getTime() + 15 * 60 * 1000; // Set OTP expiration to 15 minutes from now

  // Check if an OTP entry with the email already exists
  let otpEntry = await OTP.findOne({ email });

  if (!otpEntry) {
    // If no OTP entry exists, create a new one
    otpEntry = new OTP({ email, otp, expiresAt: expirationTime });
  } else {
    // If an OTP entry already exists, update it with a new OTP and expiration time
    otpEntry.otp = otp;
    otpEntry.expiresAt = expirationTime;
  }

  // Save the OTP entry
  await otpEntry.save();

  // Send the OTP to the user's email
  name
    ? await nodemailer.sendResetPasswordEmail(name, email, otp)
    : await nodemailer.sendConfirmationEmail(email, otp);
};

const verifyOTP = async (email, otp) => {
  const currentTime = new Date();

  // Find the OTP entry for the provided email and OTP
  const otpEntry = await OTP.findOne({ email, otp });

  if (!otpEntry) {
    throw new Error("Invalid OTP.");
  } else if (otpEntry.expiresAt < currentTime) {
    throw new Error("OTP has expired. Generate a new one.");
  } else {
    // OTP verification successful
    // Delete the OTP entry since it is no longer needed
    await OTP.deleteOne({ email, otp });

    return true;
  }
};

module.exports = {
  generateOtp,
  generateAndSendOTP,
  verifyOTP,
};
