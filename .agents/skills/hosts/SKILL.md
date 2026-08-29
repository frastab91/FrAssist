---
name: hosts
description: >-
  Automates prospecting for https://host.frastab.com/ on Facebook Group https://www.facebook.com/groups/325849768974770.
  Scans posts for house/apartment/room/coliving OFFERINGS and comments 'dm plese! :)' with duplicate prevention.
  Use when the user types /hosts or asks to find/outreach hosts on Facebook.
---

# Facebook Hosts Automated Outreach (`/hosts`)

This skill automates prospecting and lead generation for [Host Service](https://host.frastab.com/) by discovering accommodation offerings in the **Digital Nomad accommodation and co-housing** Facebook group and posting initial contact comments.

## Target Details
- **Facebook Group**: [https://www.facebook.com/groups/325849768974770](https://www.facebook.com/groups/325849768974770)
- **Comment Text**: `dm plese! :)`
- **Goal**: Reach out to hosts offering houses, apartments, rooms, or coliving spaces.

## How to Execute

### 1. Fast CLI Execution
Run the standalone outreach script from the repository root:
```bash
export PATH="$HOME/.local/bin:$PATH"
npm run hosts
```

Or for a simulated run without posting comments:
```bash
node backend/scripts/run_fb_hosts.js --dry-run
```

To adjust the maximum number of posts commented in a single batch:
```bash
node backend/scripts/run_fb_hosts.js --max 10
```

### 2. FrAssist Chat Interface
In the FrAssist web UI (`http://localhost:5173`), simply type:
```text
/hosts
```
or
```text
/hosts 5
```

### 3. Programmatic Execution in Antigravity Agent
The agent can invoke the `fb_hosts_outreach` skill in `backend/skills/fb_hosts_outreach.js`:
```javascript
import fbOutreach from './backend/skills/fb_hosts_outreach.js';

const result = await fbOutreach.execute({
  maxPosts: 5,
  dryRun: false,
  targetUrl: 'https://www.facebook.com/groups/325849768974770',
  commentText: 'dm plese! :)'
});
```

## Safety & Rate Limiting Features
1. **Duplicate Prevention**: All commented post URLs and IDs are recorded in SQLite (`facebook_outreach_log`). Any post already in the database or already showing the user's comment is skipped.
2. **Intelligent Classifier**: Distinguishes **OFFERING** posts (available places, coliving, sublets, host listings) from **SEEKING** posts (nomads looking for places).
3. **Cadence Delays**: Enforces a 3.5-second human delay between commenting actions to respect Facebook platform limits.
