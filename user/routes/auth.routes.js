const controller = require("../controller/auth.controller");
const { authMiddleware } = require("../middleware/auth");
const authRoute = require("express").Router();

authRoute.get("/users", authMiddleware, controller.getAllUsers);

authRoute.get("/user/:id", controller.getOtherUser);

authRoute.post("/user/block", authMiddleware, controller.blockUser);

authRoute.post(
  "/user/unblock/:blockedUserId",
  authMiddleware,
  controller.unblockUser
);

authRoute.post("/user/report", authMiddleware, controller.reportUser);

authRoute.put("/user/preference", authMiddleware, controller.updatePreference);

authRoute.post("/user/likes", authMiddleware, controller.userLikes);

authRoute.post("/user/dislike", authMiddleware, controller.userDislikes);

authRoute.post("/user/fav", authMiddleware, controller.userFavorites);

authRoute.post("/user/unfav", controller.userUnfavorites);

authRoute.post(
  "/:conversationId/seen",
  authMiddleware,
  controller.markMessageAsSeen
);

authRoute.post(
  "/conversations/:conversationId/message",
  authMiddleware,
  controller.sendMessage
);

authRoute.get(
  "/conversations",
  authMiddleware,
  controller.getConversationsForUser
);

authRoute.get(
  "/user/allmessages/:cId",
  controller.getAllMessagesInConversation
);

authRoute.get(
  "/conversations/:conversationId/users",
  controller.getConversationById
);

authRoute.get("/subscriptions", authMiddleware, controller.getAllSubs);

authRoute.get(
  "/user/messages/:loggedInUserId/:userId",
  controller.getMessagesBetweenUsers
);

authRoute.post("/logout", controller.logOut);

authRoute.put("/user", authMiddleware, controller.updateUser);

authRoute.post("/upload/picture", authMiddleware, controller.uploadPicture);

authRoute.post("/session", authMiddleware, controller.sessionCheck);

authRoute.get("/user-sub/:plan", authMiddleware, controller.userStatus);

authRoute.get(
  "/allmessages/:conversationId",
  authMiddleware,
  controller.getAllMessagesInConversation
);

authRoute.get(
  "/conversation/user/:uid",
  authMiddleware,
  controller.getUserInConvo
);

authRoute.put("/update/coords", authMiddleware, controller.updateCoordinates);

authRoute.put("/update/password", authMiddleware, controller.updatePassword);

authRoute.delete(
  "/photos/:photoId",
  authMiddleware,
  controller.deleteUserPicture
);

authRoute.post("/filter", authMiddleware, controller.filterUsers);

authRoute.get(
  "/likesAndFavorites",
  authMiddleware,
  controller.getUserLikesAndFav
);

module.exports = authRoute;
