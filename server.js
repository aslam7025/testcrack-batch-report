require('dotenv').config()
const express = require("express");
const fs = require("fs");
const path = require("path");
const {GoogleGenerativeAI} = require("@google/generative-ai")

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client =  new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ─── helpers ────────────────────────────────────────────────────────────────

function avg(obj) {
  const vals = Object.values(obj);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function daysBetween(dateStr, referenceDate) {
  const d = new Date(dateStr);
  return Math.floor((referenceDate - d) / (1000 * 60 * 60 * 24));
}

function daysUntil(dateStr, referenceDate) {
  const d = new Date(dateStr);
  return Math.floor((d - referenceDate) / (1000 * 60 * 60 * 24));
}

function bandDelta(student) {
  const skills = ["speaking", "writing", "reading", "listening"];
  const deltas = skills.map(
    (s) => student.current_band[s] - student.diagnostic_band[s]
  );
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

function declinedSkills(student) {
  const skills = ["speaking", "writing", "reading", "listening"];
  return skills.filter(
    (s) => student.current_band[s] < student.diagnostic_band[s]
  );
}

// ─── core aggregation (no AI here) ──────────────────────────────────────────

function aggregateBatch(batch, today) {
  const students = batch.students;
  const skills = ["speaking", "writing", "reading", "listening"];

  // Per-student computed data
  const computed = students.map((s) => {
    const currentAvg = avg(s.current_band);
    const delta = bandDelta(s);
    const daysInactive = daysBetween(s.last_active, today);
    const examDaysLeft = daysUntil(s.exam_date, today);
    const declined = declinedSkills(s);

    // at-risk: ANY ONE of three rules
    const inactiveRisk = daysInactive >= 5;
    const declineRisk = declined.length > 0;
    const examRisk =
      examDaysLeft <= 30 && s.target_band - currentAvg > 1.5;
    const isAtRisk = inactiveRisk || declineRisk || examRisk;

    const riskReasons = [];
    if (declineRisk) {
      declined.forEach((sk) => {
        riskReasons.push(
          `Band declining in ${cap(sk)} (${s.diagnostic_band[sk].toFixed(1)} → ${s.current_band[sk].toFixed(1)})`
        );
      });
    }
    if (inactiveRisk)
      riskReasons.push(`Inactive for ${daysInactive} days`);
    if (examRisk)
      riskReasons.push(
        `Exam in ${examDaysLeft} days with avg band ${currentAvg.toFixed(1)} vs target ${s.target_band}`
      );

    return {
      student: s,
      currentAvg,
      delta,
      daysInactive,
      examDaysLeft,
      declined,
      isAtRisk,
      riskReasons,
    };
  });

  // Summary stats
  const totalStudents = students.length;
  const activeThisWeek = computed.filter((c) => c.daysInactive < 7).length;
  const atRiskList = computed.filter((c) => c.isAtRisk);

  const mostImproved = computed.reduce((best, c) =>
    c.delta > best.delta ? c : best
  );

  const batchAvgImprovement =
    computed.reduce((sum, c) => sum + c.delta, 0) / computed.length;

  const summaryStats = {
    total_students: totalStudents,
    active_this_week: activeThisWeek,
    at_risk: atRiskList.length,
    most_improved_student: mostImproved.student.name,
    most_improved_delta: parseFloat(mostImproved.delta.toFixed(2)),
    batch_average_improvement: parseFloat(batchAvgImprovement.toFixed(2)),
  };

  const atRiskStudents = atRiskList.map((c) => ({
    student_id: c.student.id,
    name: c.student.name,
    risk_reason: c.riskReasons.join(". ") + ".",
    recommended_action: "Immediate tutor contact",
    // extra fields for WhatsApp prompt
    _examDaysLeft: c.examDaysLeft,
    _currentAvg: c.currentAvg,
    _target: c.student.target_band,
    _sessions: c.student.sessions_completed,
  }));

  const studentSummaries = computed.map((c) => ({
    student_id: c.student.id,
    name: c.student.name,
    sessions_completed: c.student.sessions_completed,
    days_inactive: c.daysInactive,
    exam_days_left: c.examDaysLeft,
    current_avg_band: parseFloat(c.currentAvg.toFixed(2)),
    target_band: c.student.target_band,
    avg_band_delta: parseFloat(c.delta.toFixed(2)),
    at_risk: c.isAtRisk,
    current_band: c.student.current_band,
  }));

  return { summaryStats, atRiskStudents, studentSummaries, computed };
}

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── AI narrative (pre-computed stats only) ──────────────────────────────────

async function generateNarrative(batch, stats, atRisk) {
  const atRiskNames = atRisk.map((s) => s.name).join(", ") || "none";
  const prompt = `You are writing a weekly batch progress summary for a tutor.

Batch: ${batch.batch_id} | Exam type: ${batch.exam_type}
Total students: ${stats.total_students}
Active this week: ${stats.active_this_week}
At-risk students: ${stats.at_risk} (${atRiskNames})
Most improved student: ${stats.most_improved_student} (avg band delta: +${stats.most_improved_delta})
Batch average improvement: ${stats.batch_average_improvement > 0 ? "+" : ""}${stats.batch_average_improvement} bands

Write exactly 3 sentences as a narrative summary for the tutor. Be direct, specific, and professional. Do not include any heading or preamble.`;

 const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
 const response = await model.generateContent(prompt)
 return response.response.text().trim();
}

// ─── AI WhatsApp alert (per at-risk student) ─────────────────────────────────

async function generateWhatsAppMessage(studentInfo) {
  const prompt = `Write a WhatsApp message a tutor would send to an IELTS student who needs urgent attention. 
Keep it warm, encouraging, and concise (1 paragraph, under 80 words). Use the student's first name.

Student name: ${studentInfo.name}
Risk reason: ${studentInfo.risk_reason}
Sessions completed: ${studentInfo._sessions}
Current avg band: ${studentInfo._currentAvg.toFixed(1)}
Target band: ${studentInfo._target}
Exam in: ${studentInfo._examDaysLeft} days

Write only the message text, no labels or preamble.`;

 const model = client.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
 const response = await model.generateContent(prompt);
 return response.response.text().trim();
}

// ─── route ───────────────────────────────────────────────────────────────────

app.post("/api/batch-report", async (req, res) => {
  try {
    const { batch_id } = req.body;
    if (!batch_id) {
      return res.status(400).json({ error: "batch_id is required" });
    }

    // Load from disk
    const filePath = path.join(__dirname, "data", `${batch_id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `Batch '${batch_id}' not found` });
    }
    const batch = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    const today = new Date("2026-05-16"); // fixed for demo; use new Date() in production

    // 1. All arithmetic — your code
    const { summaryStats, atRiskStudents, studentSummaries } =
      aggregateBatch(batch, today);

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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`TestCrack API running → http://localhost:${PORT}`)
);
