require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 8002;
const mongoose = require("mongoose");
const authAdminRoute = require("./routes/auth.routes");
const { User } = require("../shared/model/User");

const app = express();

mongoose
  .connect(process.env.uri)
  .then(() => {
    console.log("Connected to MongoDB!");
    // initial();
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB", err);
  });

app.use(
  cors({
    origin: [
      "https://admin-lovebirdz.web.app",
      "https://lovebirdz-391210.web.app",
      "https://dobb-8c058.web.app",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/admin", authAdminRoute);

// const deleteUser = async () => {
//   await User.findOneAndDelete({ email: "aquaderrands@gmail.com" });
// };

// deleteUser().then((re) => re);

app.listen(port, () => {
  console.log("Server running on port", port);
});
