require('dotenv').config()
const express = require("express");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");
const reportRoutes = require("./routes/reportRoutes");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

  
app.use('/api', reportRoutes)  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`TestCrack API running → http://localhost:${PORT}`)
);
