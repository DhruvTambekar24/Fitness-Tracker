const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const cors = require("cors");
const crypto = require("crypto");
const { Client, ID, Databases } = require("node-appwrite");
require("dotenv").config();
const fs = require("fs");


let credentials;
try {
  credentials = JSON.parse(fs.readFileSync("./creds.json"));
} catch (error) {
  console.error("Error loading Google credentials:", error);
  process.exit(1);
}

const { client_secret, client_id, redirect_uris } = credentials.web || {};
if (!client_id || !client_secret || !redirect_uris) {
  console.error("Google OAuth credentials are missing or invalid.");
  process.exit(1);
}

// const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:8000/auth/google/callback");

// Initialize Appwrite Client
const client = new Client();
client.setEndpoint("https://cloud.appwrite.io/v1")
  .setProject(process.env.PROJECT_ID)
  .setKey(process.env.API_KEY);

const database = new Databases(client);

// Google Fitness API Scopes
const SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.blood_glucose.read",
  "https://www.googleapis.com/auth/fitness.blood_pressure.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
  "https://www.googleapis.com/auth/fitness.reproductive_health.read",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const secretKey = crypto.randomBytes(32).toString("hex");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(session({ secret: secretKey, resave: false, saveUninitialized: true }));

let userProfileData = null;

async function getUserProfile(auth) {
  try {
    const service = google.people({ version: "v1", auth });
    const profile = await service.people.get({
      resourceName: "people/me",
      personFields: "names,photos,emailAddresses",
    });

    return {
      displayName: profile.data.names?.[0]?.displayName || "Unknown User",
      profilePhotoUrl: profile.data.photos?.[0]?.url || "",
      userID: profile.data.resourceName?.replace("people/", "") || "",
    };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.get("/auth/google", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
  res.json({ authUrl });
});
app.get("/auth/user", (req, res) => {
  if (!req.session.userProfile) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  
  res.json(req.session.userProfile); // Send user profile as response
});

// app.get("/auth/google/callback", async (req, res) => {
//   const { code } = req.query;
//   if (!code) {
//     return res.status(400).json({ error: "Missing authorization code" });
//   }

//   try {
//     const { tokens } = await oAuth2Client.getToken(code);
//     oAuth2Client.setCredentials(tokens);
//     req.session.tokens = tokens;

//     const profile = await getUserProfile(oAuth2Client);
//     if (!profile) throw new Error("Failed to fetch user profile");

//     req.session.userProfile = profile;
//     userProfileData = profile;

//     res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
//   } catch (error) {
//     console.error("Error retrieving access token:", error);
//     res.redirect("/error");
//   }
// });
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    req.session.tokens = tokens; // Store tokens in session

    const userOAuthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    userOAuthClient.setCredentials(tokens);

    const profile = await getUserProfile(userOAuthClient);
    if (!profile) throw new Error("Failed to fetch user profile");

    req.session.userProfile = profile; // Store user profile in session
    
    // console.log("User authenticated:", profile);
    // return res.json(profile);

    res.redirect(`http://localhost:5173/dashboard?user=${profile.userID}`);
  } catch (error) {
    console.error("Error retrieving access token:", error);
    res.redirect("/error");
  }
});

app.get("/fetch-data", async (req, res) => {
  console.log("Session Data:", req.session); 

  const userProfile = req.session.userProfile;
  if (!userProfile) {
    return res.status(401).json({ error: "User not authenticated" });
  }

  if (!req.session.tokens) {
    return res.status(401).json({ error: "User tokens not found. Please reauthenticate." });
  }

  try {
    const userOAuthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    userOAuthClient.setCredentials(req.session.tokens);

    const fitness = google.fitness({ version: "v1", auth: userOAuthClient });

    const { displayName, profilePhotoUrl, userID } = userProfile;
    const startTimeMillis = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const endTimeMillis = Date.now();

    const response = await fitness.users.dataset.aggregate({
      userId: "me",
      requestBody: {
        aggregateBy: [
          { dataTypeName: "com.google.step_count.delta" },
          { dataTypeName: "com.google.heart_rate.bpm" },
        ],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis,
        endTimeMillis,
      },
    });

    const formattedData = response.data.bucket.map((data) => {
      const stepData = data.dataset.find(d => d.dataSourceId.includes("step_count"));
      const heartRateData = data.dataset.find(d => d.dataSourceId.includes("heart_rate"));

      return {
        date: new Date(parseInt(data.startTimeMillis)).toDateString(),
        step_count: stepData?.point?.[0]?.value?.[0]?.intVal || 0,
        heart_rate: heartRateData?.point?.[0]?.value?.[0]?.fpVal || 0,
      };
    });

    try {
      await saveUserDataToAppwrite({ displayName, profilePhotoUrl, userID });
    } catch (error) {
      console.error("Failed to save user data to Appwrite:", error);
    }

    res.json({ displayName, profilePhotoUrl, userID, formattedData });
  } catch (error) {
    console.error("Error fetching fitness data:", error);
    res.status(500).json({ error: "Failed to fetch fitness data" });
  }
});

// app.get("/fetch-data", async (req, res) => {
//   const userProfile = req.session.userProfile;
//   if (!userProfile) {
//     return res.status(401).json({ error: "User not authenticated" });
//   }

//   try {
//     const userOAuthClient = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
//     userOAuthClient.setCredentials(req.session.tokens); // Set user-specific tokens

//     const fitness = google.fitness({ version: "v1", auth: userOAuthClient });

//     const { displayName, profilePhotoUrl, userID } = userProfile;
//     const startTimeMillis = Date.now() - 14 * 24 * 60 * 60 * 1000;
//     const endTimeMillis = Date.now();

//     const response = await fitness.users.dataset.aggregate({
//       userId: "me",
//       requestBody: {
//         aggregateBy: [
//           { dataTypeName: "com.google.step_count.delta" },
//           { dataTypeName: "com.google.heart_rate.bpm" },
//         ],
//         bucketByTime: { durationMillis: 86400000 },
//         startTimeMillis,
//         endTimeMillis,
//       },
//     });

//     const formattedData = response.data.bucket.map((data) => ({
//       date: new Date(parseInt(data.startTimeMillis)).toDateString(),
//       step_count: 0,
//       heart_rate: 0,
//     }));

//     await saveUserDataToAppwrite({ displayName, profilePhotoUrl, userID });

//     res.json({ displayName, profilePhotoUrl, userID, formattedData });
//   } catch (error) {
//     console.error("Error fetching fitness data:", error);
//     res.status(500).json({ error: "Failed to fetch fitness data" });
//   }
// });

const saveUserDataToAppwrite = async (userData) => {
  try {
    const users = await database.listDocuments(process.env.DATABASE_ID, process.env.COLLECTION_ID);
    const userExists = users.documents.some((user) => user.profileURL === userData.profilePhotoUrl);

    if (!userExists) {
      await database.createDocument(process.env.DATABASE_ID, process.env.COLLECTION_ID, ID.unique(), {
        username: userData.displayName,
        profileURL: userData.profilePhotoUrl,
        userID: userData.userID,
      });
    } else {
      console.log("User already exists.");
    }
  } catch (error) {
    console.error("Error saving user data to Appwrite:", error);
  }
};


const saveFitnessDataToAppwrite = async (fitnessData) => {
  try {
    await database.createDocument(process.env.DATABASE_ID, process.env.FITNESS_COLLECTION_ID, ID.unique(), fitnessData);
    console.log("Fitness data saved to Appwrite.");
  } catch (error) {
    console.error("Error saving fitness data to Appwrite:", error);
  }
};

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
