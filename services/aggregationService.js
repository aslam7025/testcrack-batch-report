const {
  avg,
  daysBetween,
  daysUntil,
  bandDelta,
  declinedSkills,
  cap,
} = require("../utils/helpers");

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

module.exports = {
  aggregateBatch,
};
