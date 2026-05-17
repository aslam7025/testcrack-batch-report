const express = require("express");
const { generateBatchReport } = require("../controllers/reportController");

const router = express.Router();

router.post("/batch-report", generateBatchReport);

module.exports = router;
