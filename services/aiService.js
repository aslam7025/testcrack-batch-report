const { GoogleGenerativeAI } = require("@google/generative-ai");

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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

 const model = client.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
 const response = await model.generateContent(prompt)
 return response.response.text().trim();
}

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

 const model = client.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
 const response = await model.generateContent(prompt);
 return response.response.text().trim();
}

module.exports = {
  generateNarrative,
  generateWhatsAppMessage,
};
