const controller = require("../controller/signin.controller");
const signInRoute = require("express").Router();

signInRoute.post("/signin", controller.signInWithEmail);

signInRoute.post("/verify-number", controller.verifyPhoneNumber);

signInRoute.post("/verify-email", controller.checkEmail);

signInRoute.put("/update-password", controller.updatePassword);

signInRoute.post("/other-services", controller.sigInWithOtherServices);

module.exports = signInRoute;
