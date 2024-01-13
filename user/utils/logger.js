const winston = require("winston");

const createLogger = (filename) => {
  return winston.createLogger({
    level: "error",
    format: winston.format.json(),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename, level: "error" }),
    ],
  });
};

module.exports = createLogger;
