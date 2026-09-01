# Wanderis / Overnight — Host Outreach Workflow

## 🎯 Current Goal
**Outreach to hosts so they start putting their listings on the Wanderis/Overnight platform.**

The marketplace needs host supply: we are actively recruiting hosts by engaging with people who OFFER vacation rentals, converting them to list on the platform.

## 🔄 Outreach Method — Facebook Group Comments
**Target Group URL:** `https://www.facebook.com/groups/325849768974770/?sorting_setting=CHRONOLOGICAL`
- Group name: "Digital Nomad Accommodation & Co-housing"
- Sort the feed **CHRONOLOGICAL (newest first)** to catch the most recent posts.

### Workflow Rules (STRICT)
1. **Only comment on posts that OFFER vacation/accommodation** (hosts offering houses, rooms, apartments, co-living, coliving). Skip posts from people SEEKING accommodation.
2. **Comment text**: something like "beautiful! please pm :)" or similar — the aim is to grab the host's attention and move the convo to private message (PM).
3. **EVERY comment must be DIFFERENT** — vary the wording on each post. Do not repeat the same comment.
4. **NEVER comment twice on the same post** — dedupe by post. Track commented posts and skip duplicates.
5. **Minimum target**: at least 5 verified comments per run (do NOT stop at just 2).
6. **Verify** each comment actually appears on the account before recording it as success.

## 📬 Daily Follow-up
**Once a day**, check the **Facebook message requests** folder to review and respond to hosts who PM'd us from the comments.
- Goal: convert interested hosts and guide them to create their listing on the platform.
- Since all comments are unique and conversational ("please pm :)"), the follow-up is where the actual listing conversion conversation happens.

## 🔧 Tooling
- `fb_hosts_outreach` tool automates this workflow: it navigates the group, sorts newest first, classifies posts (offering vs seeking), posts unique comments with duplicate prevention, verifies comments appear, and scans enough posts to reach a target.
- Parameters: `maxPosts` (target verified comments, enforced min 5), `commentText`, `maxScan` (posts scanned, ~50-100), `dryRun` (scan/classify without posting).
- A recurring daily job schedules this (e.g. 10:00 AM) with the updated rule of ≥5 verified comments.

## 🏷️ Differentiation Reminder
This outreach is for **Wanderis/Overnight** (the marketplace). It is **DISTINCT** from the `Host` project (host.frastab.com). Even though the `fb_hosts_outreach` tool historically promoted host.frastab.com, the CURRENT goal for Wanderis/Overnight is recruiting hosts to LIST on the platform — a different objective. Keep these two projects clearly separate.
