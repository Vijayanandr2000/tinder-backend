const express = require("express");
const mongodb = require("mongodb");
const JWT = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cors = require("cors");
const dotenv = require("dotenv");

const app = express();
app.use(express.json());
app.use(cors());
dotenv.config();

const DBURL =
  "mongodb+srv://tinder-server:pDPvE7RYWThUag5k@cluster0.markv.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const mongoClient = mongodb.MongoClient;
const objectId = mongodb.ObjectID;
const DB_URL = DBURL || "mongodb://127.0.0.1:27017";

const port = process.env.PORT || 5000;

const ACCOUNT_SID = process.env.ACCOUNT_SID;
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const SERVICE_ID = process.env.SERVICE_ID;

const client = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);

// /login
//     - phone number
//     - channel (sms/call)

// /verify
//     - phone number
//     - code

app.get("/", (req, res) => {
  res.send("APP IS WORKING FROM SERVER.....!");
});

//OTP SENDING TO THE MOBILE NUMBER

app.post("/mob-reg", (req, res) => {
  console.log(req.body.num);
  client.verify
    .services(SERVICE_ID)
    .verifications.create({
      to: `+91${req.body.num}`,
      channel: "sms",
    })
    .then((data1) => {
      res.json({ message: "sent" });
    });
});

//VERIFING THE OTP

app.get("/verify", (req, res) => {
  client.verify
    .services(SERVICE_ID)
    .verificationChecks.create({
      to: `+91${req.body.num}`,
      code: "5093",
    })
    .then((data) => {
      if (data.status === "approved") {
        res.status(200).send({
          message: "User is Verified!!",
          data,
        });
      }
    });
});

//REGISTER THE USER DETAILS

app.post("/register", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(req.body.password, salt);
    const data = {
      name: req.body.name,
      mail: req.body.mail,
      number: req.body.num,
      password: hash,
    };
    var mailValid = await db
      .collection("user")
      .findOne({ mail: req.body.mail });
    if (mailValid) {
      res.status(400).json({ message: "Email already exists" });
    } else {
      await db.collection("user").insertOne(data);
    }
    res.status(200).json({ message: "Registered" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

//LOGIN BY THE USER

app.post("/login", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");
    const user = await db.collection("user").findOne({ mail: req.body.mail });
    if (user) {
      var cmp = await bcrypt.compare(req.body.password, user.password);
      if (cmp) {
        var userToken = await JWT.sign({ mail: user.mail }, "loginUser");
        res
          .header("auth", userToken)

          .json({ message: "allow", userToken });
      } else {
        res.status(400).json({ message: "Password Incorrect" });
      }
    } else {
      res.status(400).json({
        message: "Email not found",
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

//  AUTHENTICATION

const authenticate = (req, res, next) => {
  const token = req.header("auth");
  req.token = token;
  next();
};

//   RESET THE PASSWORD THE MAIL IS SENDING TO THE USER

app.post("/reset", async (req, res) => {
  try {
    let client = await mongoClient.connect(DB_URL);
    let db = client.db("login");
    let user = await db.collection("user").findOne({ mail: req.body.mail });
    // console.log(user)
    if (!user) alert("User not found");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });
    let mailOptions = {
      from: process.env.EMAIL,
      to: user.mail,
      subject: "Reset Password",
      text: "click here to reset password",
      html: '<h3>Reset your password Here</h3><a href="http://localhost:3000/forget-pass">Click Here</a>',
    };
    // console.log(mailOptions);
    transporter.sendMail(mailOptions, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Email Sent");
      }
    });
    res.json({ message: "sent" });
    // client.close();
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
});

// PASSWORD HAS BEEN RESETED

app.put("/forget-pass", async (req, res) => {
  try {
    let client = await mongoClient.connect(DB_URL);
    let db = client.db("login");
    let salt = await bcrypt.genSalt(10);
    let hash = await bcrypt.hash(req.body.pass, salt);
    req.body.code = hash;
    let update = await db
      .collection("user")
      .findOneAndUpdate({ mail: req.body.mail }, { $set: { password: hash } });
    client.close();
    res.json({ message: "password update", update });
  } catch (error) {
    console.log(error);
    res.json({ message: error.message });
  }
});

// SAVING THE LIKED PROFILE BY THE USER

app.post("/liked", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");
    const data = {
      name: req.body.name,
      image: req.body.image,
    };
    const user = await db.collection("liked").insertOne(data);
    res.status(200).json({ message: "LIKED" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

// DISLIKED PROFILE BY THE USERS

app.post("/disliked", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");
    const data = {
      name: req.body.name,
      image: req.body.image,
    };
    const user = await db.collection("disliked").insertOne(data);
    res.status(200).json({ message: "DISLIKED" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

//   HISTORY OF THE USER LIKED AND DISLIKED PROFILE

app.get("/liked", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");

    const data = await db.collection("liked").find().toArray();
    res.status(200).json({ message: "Liked profile by the user", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

app.get("/disliked", async (req, res) => {
  try {
    const client = await mongoClient.connect(DB_URL);
    const db = client.db("login");

    const data = await db.collection("disliked").find().toArray();
    res.status(200).json({ message: "Disl+iked profile by the user", data });
  } catch (err) {
    res.status(500).json({ message: err.message });
  } finally {
    client.close();
  }
});

app.listen(port, () => {
  console.log(`Server is running at ${port}`);
});
