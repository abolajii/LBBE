require("dotenv").config();
const nodemailer = require("nodemailer");

const user = process.env.user;
const host = process.env.host;
const pass = process.env.pass;

const transport = nodemailer.createTransport({
  host,
  port: 465,
  secure: true,
  debug: true,
  logger: true,
  auth: {
    user,
    pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

module.exports.sendConfirmationEmail = async (email, otp) => {
  await new Promise((resolve, reject) => {
    console.log("sending mail...");
    // send mail
    transport.sendMail(
      {
        from: user,
        to: email,
        subject: "Email confirmation code",
        html: `
      <html>
      <body style="margin: 0; padding: 0; box-sizing: border-box;">
      <p>Hello there,</p>
      <p>Here's the 6 digits OTP to confirm your email</p>
      <div style="display: flex;">
      <div style="margin-right: 10px; font-weight: 600; font-size: 18px">
      <p>${otp[0]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[1]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[2]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[3]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[4]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[5]}</p>
      </div>
      </div>
      </body>
      </html>
          `,
      },
      (err, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      }
    );
  });
};

module.exports.sendResetPasswordEmail = async (name, email, otp) => {
  await new Promise((resolve, reject) => {
    console.log("sending mail...");
    // send mail
    transport.sendMail(
      {
        from: user,
        to: email,
        subject: "Reset password link",
        html: `
      <html>
      <body style="margin: 0; padding: 0; box-sizing: border-box;">
      <p>Hello ${name},</p>
      <p>Here's the 6 digits OTP</p>
      <div style="display: flex;">
      <div style="margin-right: 10px; font-weight: 600; font-size: 18px">
      <p>${otp[0]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[1]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[2]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[3]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[4]}</p>
      </div>
      <div style="margin: 0 10px; font-weight: 600; font-size: 18px">
      <p>${otp[5]}</p>
      </div>
      </div>
      </body>
      </html>
          `,
      },
      (err, info) => {
        if (err) {
          reject(err);
        } else {
          resolve(info);
        }
      }
    );
  });
};

module.exports.userCreatedByAdmin = async (user) => {
  await new Promise((resolve, reject) => {
    console.log("sending mail...");
    // send mail
    transport.sendMail({
      from: user,
      to: email,
    });
  });
};
