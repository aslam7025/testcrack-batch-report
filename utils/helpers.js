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

function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

module.exports = {
  avg,
  daysBetween,
  daysUntil,
  bandDelta,
  declinedSkills,
  cap,
};
