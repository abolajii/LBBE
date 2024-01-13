const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "1639972",
  key: "ee79995ac9f5f6c88f53",
  secret: "8efc933ed3d6cdf28356",
  cluster: "mt1",
  useTLS: true,
});

module.exports = { pusher };
