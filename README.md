# TestCrack — Batch Progress Report Generator

## Project Structure

```
testcrack/
├── server.js                      ← Express API + all calculation logic
├── package.json
├── data/
│   └── batch-kerala-2026.json     ← student data loaded from disk
└── public/
    └── index.html                 ← Frontend dashboard
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your Anthropic API key:
   ```bash
   # Mac/Linux
   export ANTHROPIC_API_KEY=sk-ant-...

   # Windows
   set ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Start the server:
   ```bash
   node server.js
   ```

4. Open your browser at: http://localhost:3000

## How It Works

### Backend (server.js)
- `POST /api/batch-report` — accepts `{ "batch_id": "batch-kerala-2026" }`
- Loads student JSON from `./data/{batch_id}.json`
- **All arithmetic done in code** (no AI for numbers):
  - Average band per student
  - Band delta (improvement from diagnostic)
  - At-risk classification (3 rules)
  - Most improved student
  - Batch average improvement
- **AI used only for:**
  - 3-sentence narrative summary (receives pre-computed stats only)
  - WhatsApp alert message per at-risk student (bonus feature)

### At-Risk Rules (any ONE triggers at-risk)
1. Inactive for 5+ days
2. Any skill band declined from diagnostic
3. Exam within 30 days AND avg band > 1.5 below target

### Frontend (public/index.html)
- Plain HTML + CSS + JS (no framework)
- Generates report with one click
- Shows stat cards, AI narrative, at-risk alerts, student table, skill bars
- Download as **PDF** (jsPDF) or **JSON**
- Copy WhatsApp messages with one click

## API Response Shape

```json
{
  "batch_id": "batch-kerala-2026",
  "report_date": "2026-05-16",
  "summary_stats": {
    "total_students": 4,
    "active_this_week": 2,
    "at_risk": 2,
    "most_improved_student": "Rahul P",
    "most_improved_delta": 0.5,
    "batch_average_improvement": 0.25
  },
  "at_risk_students": [
    {
      "student_id": "s003",
      "name": "Priya S",
      "risk_reason": "...",
      "recommended_action": "Immediate tutor contact",
      "tutor_alert_message": "Hi Priya, ..."
    }
  ],
  "ai_narrative": "This week...",
  "student_summaries": [ ... ]
}
```
