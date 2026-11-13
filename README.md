# CSM Copilot

Sample data. Built on Equinix-style data for demonstration. Not an official tool.

## The problem
Four Customer Success Managers (CSMs) cover 60 enterprise data center accounts. They usually find out an account is unhappy when it is already late. Before each call they dig through support cases, invoices and notes by hand, which takes about 30 minutes per call.

## What I built
A static web page with two views:

1. **Risk Radar.** All accounts ranked by churn risk. Every score lists its reasons in plain words, for example "power use at 36% of contract", "2 open P1 cases, 1 escalated", "renewal in 38 days". Growing accounts (power over contract, expansion notes) sit in a separate **Expansion** list, so growth is never mistaken for risk.
2. **Call Prep Brief.** Click an account to see a one page brief. The top block, **From the data**, holds facts only: health numbers, why the score is what it is, open cases and CSM notes. The bottom block, **AI summary**, holds a short summary, risks to raise and three talking points written by an AI model.

Each brief opens with one **Do this week** step, picked by plain rules from the biggest reason (for example "champion left" leads to "Find and meet the new decision maker"), and the account's main contact so the CSM does not have to look it up. Every reason also says in plain words why it matters.

An **About this data** section at the bottom lists everything that was cleaned before scoring. It is there for whoever owns the data, not for the CSM.

## How the score works
Each warning sign adds points, a renewal within 180 days multiplies the total, and every point is shown as a reason.

| Signal | Points |
|---|---|
| Power use under 50% of contract | up to 20 (more the lower it goes) |
| Interconnections down over 6 months | up to 15 (full at a 20% drop) |
| Open P1 / P2 cases | 10 / 5 each, +5 if escalated, capped at 30 |
| Past due invoices | 8 each, capped at 16 |
| CSAT of 1 or 2 / CSAT of 3 | 15 / 6 |
| No CSM touch for over 45 days | up to 15 (full at 90 days) |
| CSM note says the customer may leave ("evaluating options", "champion left", "moving workloads") | 40 |
| CSM note says the customer is unhappy ("frustrated", "billing dispute") | 15 |
| Renewal within 90 / 180 days | score x1.5 / x1.25 |

Notes weigh the most on purpose. What a customer tells their CSM often comes before the numbers move. In the sample data, Sable AI looks healthy on every number (CSAT 5 of 5, touched 8 days ago, no past due invoices, interconnections growing) and scores only 10 points from the numbers. Its CSM note says the CTO is "evaluating options in Dallas", which lifts it to number 1 of 58.

All weights, thresholds and note phrases live in one file, `config/scoring.json`. Scoring is plain code, no AI.

## Messy data handled
Duplicate account rows (kept the latest CSM touch), missing renewal dates (shown as "renewal unknown", account kept), negative and "n/a" values (treated as missing, left out of the score, never counted as zero), a case linked to an account that does not exist (reported, left out), blank case categories ("Uncategorized"), case close dates after the data date (reported), and last CSM touch dates older than the CSM's own notes (8 accounts; the note date is used, because notes are written after calls). 21 issues in total, all listed under About this data.

## How the AI part stays honest
- The briefs are written once by a batch script with a small, low cost model (Claude Haiku 5.5) and saved to `briefs.json`. The page never calls the AI and holds no API key.
- The model sees only the facts the page shows. Notes are passed as data, not instructions.
- Every number in the AI text is checked against the facts. A brief with a number that is not in the data is retried, then flagged on the page as "check needed". All 60 current briefs pass.
- The AI text is visibly separate, labeled with the model name, and marked pre-written.
- Cost, measured: about 2 cents for all 60 briefs (about $0.0004 per brief).

## The value
Call prep drops from about 30 minutes to about 2: open the brief, read the reasons, use the talking points. For 4 CSMs with around 10 calls a week each, that is roughly 18 hours a week back. The bigger win is earlier warning: an account like Sable AI shows up this week, not at renewal.

How I would measure it: time a few CSMs prepping with and without the tool for two weeks, and track how many at-risk accounts were contacted before an escalation or a renewal conversation.

## Risks and limits
- The weights are my judgment, not trained on real churn. They need tuning against real outcomes.
- Note phrases are simple text matches. "Not evaluating options" would still match. A real version would need better note reading.
- The AI can still word something badly even when its numbers are right. The CSM reads it before using it.
- The data is a snapshot. Live data would need a sync and a refresh schedule.
- The contacts (names, emails at example.com, 555 phone numbers) are made up for the demo. The real ones would come from the CRM.
- The "Your notes" box is a placeholder. It does not save anything yet.

## Next steps
- Alerts for urgent cases, ranked by account risk and revenue.
- Pull live data from Salesforce or Gainsight instead of CSV files.
- Pilot with two CSMs and measure prep time saved.
- Let CSMs log call notes that write back to the CRM and feed the next score.

## Run it
```bash
python3 -m unittest discover -s tests   # 40 tests
python3 pipeline/build.py               # clean, score, write app-data.json
python3 pipeline/briefs.py              # write AI briefs once (needs Anthropic credentials)
python3 pipeline/briefs.py --check      # verify every brief, no API calls
python3 -m http.server 8000             # open http://localhost:8000
```
The site itself is static: `index.html`, `styles.css`, `app.js`, `app-data.json`, `briefs.json`.
