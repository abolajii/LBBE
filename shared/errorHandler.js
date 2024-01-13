const winston = require("winston");

const logger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
  ],
});

const logError = (error) => {
  logger.error("An error occurred:", error);
};

module.exports = {
  logError,
};
