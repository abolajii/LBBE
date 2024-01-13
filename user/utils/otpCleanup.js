const cron = require("node-cron");
const OTP = require("../../shared/model/Otp");

const runOTPCleanup = () => {
  // Schedule a task to run daily and delete expired OTP entries
  cron.schedule("0 0 * * *", async () => {
    try {
      const currentTime = new Date();
      const expiredOtpEntries = await OTP.deleteMany({
        expiresAt: { $lt: currentTime },
      });

      console.log(
        `${expiredOtpEntries.deletedCount} expired OTP entries deleted.`
      );
    } catch (error) {
      console.error("Error deleting expired OTP entries:", error);
    }
  });
};

module.exports = runOTPCleanup;
