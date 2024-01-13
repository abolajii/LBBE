const controller = require("../controller/auth.controller");
const authAdminRoute = require("express").Router();

authAdminRoute.get("/dashboard", controller.getDashboardDetails);

authAdminRoute.get("/user/:id", controller.getSingleUser);

authAdminRoute.get("/users", controller.getAllUsers);

authAdminRoute.post("/create-user", controller.createAdminUser);

authAdminRoute.put("/update/:uid", controller.updateUser);

authAdminRoute.post("/upload", controller.upload);

authAdminRoute.delete("/delete/:id", controller.deleteUser);

authAdminRoute.get("/reports", controller.getReports);

authAdminRoute.post("/convo/user", controller.getConversationByParticipants);

authAdminRoute.get("/report/:reportId", controller.getSingleReport);

authAdminRoute.put("/report/:reportId", controller.updateReport);

authAdminRoute.put("/update/interest/:id", controller.updateInterest);

authAdminRoute.put("/:userId/coordinates", controller.updateUserCoordinates);

authAdminRoute.get("/user-activity/:year/:id", controller.getUserActivityData);

authAdminRoute.put("/update/preference/:uid", controller.updateUserPreference);

module.exports = authAdminRoute;
