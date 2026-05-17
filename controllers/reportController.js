const fs = require("fs");
const path = require("path");
const { aggregateBatch } = require("../services/aggregationService");
const { generateNarrative, generateWhatsAppMessage } = require("../services/aiService");

async function generateBatchReport(req, res) {
  try {
    const { batch_id } = req.body;
    if (!batch_id) {
      return res.status(400).json({ error: "batch_id is required" });
    }

    // Load from disk
    const filePath = path.join(__dirname, "..", "data", `${batch_id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Batch '${batch_id}' not found` });
    }
    const batch = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const today = new Date("2026-05-16"); // fixed for demo; use new Date() in production

    // 1. All arithmetic — your code
    const { summaryStats, atRiskStudents, studentSummaries } = aggregateBatch(batch, today);

    // 2. AI narrative — receives only pre-computed stats
    const aiNarrative = await generateNarrative(batch, summaryStats, atRiskStudents);

    // 3. Bonus: WhatsApp messages — AI, scoped per student
    const atRiskWithAlerts = await Promise.all(
      atRiskStudents.map(async (s) => {
        const msg = await generateWhatsAppMessage(s);
        const { _examDaysLeft, _currentAvg, _target, _sessions, ...clean } = s;
        return { ...clean, tutor_alert_message: msg };
      })
    );

    const report = {
      batch_id: batch.batch_id,
      report_date: today.toISOString().split("T")[0],
      summary_stats: summaryStats,
      at_risk_students: atRiskWithAlerts,
      ai_narrative: aiNarrative,
      student_summaries: studentSummaries,
    };

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  generateBatchReport,
};
