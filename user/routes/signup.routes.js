const controller = require("../controller/signup.controller");
const signUpRoute = require("express").Router();

signUpRoute.post("/check-email", controller.checkDuplicateEmail);

signUpRoute.post("/check-phone", controller.checkDuplicatePhoneNumber);

signUpRoute.post("/register", controller.registerUser);

signUpRoute.post(
  "/register/other-services",
  controller.registerUserWithOtherServices
);

signUpRoute.post("/upload", controller.upload);

signUpRoute.post("/verify-token", controller.verifyOtherServices);

signUpRoute.post("/verify-otp", controller.verifyOtp);

module.exports = signUpRoute;
