# Bookmarks Service (Markdown Storage & Retrieval)

## Overview
FrAssist includes a dedicated **Bookmarks Service** that allows users to save any chat message (assistant or user) directly as a structured Markdown (`.md`) file to the filesystem (`backend/bookmarks/`). Bookmarked messages can then be retrieved, searched, rendered, exported, or deleted from a new UI section accessible via the sidebar and top header.

---

## 1. Storage & File Specifications

- **Directory Path:** `backend/bookmarks/`
- **File Naming Convention:** `bookmark_<YYYY-MM-DD>_<slug>_<shortId>.md`
- **Portability:** Standard CommonMark/GFM format compatible with Obsidian, VS Code, Finder, and GitHub.
- **Watcher Exemption:** Added to `nodemon.json` ignore list to avoid unintended backend restarts when notes are bookmarked.

### File Format & YAML Frontmatter
Each `.md` file is structured with standard YAML frontmatter:

```markdown
---
id: "msg_1788488311634"
title: "How to architect agent memory with SQLite"
date: "2026-09-04T02:21:47.843Z"
role: "assistant"
agent: "orchestrator"
sessionId: "session_default"
model: "gemini-3.8-flash"
tags: ["bookmark", "saved"]
---

# How to architect agent memory with SQLite

This is the bookmarked content...
```

---

## 2. REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/bookmarks` | Returns all saved bookmarks with metadata and list of `bookmarkedMessageIds` |
| `POST` | `/api/bookmarks` | Creates or updates a bookmark `.md` file from a message payload or SQLite ID |
| `GET` | `/api/bookmarks/:filename` | Retrieves a specific bookmark's metadata and content |
| `GET` | `/api/bookmarks/download/:filename` | Serves the `.md` file as a download attachment |
| `DELETE` | `/api/bookmarks/:filename` | Deletes the bookmark file by filename |
| `DELETE` | `/api/bookmarks/message/:messageId` | Deletes the bookmark associated with a given `messageId` |

### Sample Payload for `POST /api/bookmarks`
```json
{
  "messageId": "msg_123456",
  "content": "Message markdown text...",
  "role": "assistant",
  "agentId": "orchestrator",
  "sessionId": "session_default",
  "model": "gemini-3.8-flash",
  "title": "Optional custom title"
}
```

---

## 3. Frontend UI Components

1. **ChatMessage Action Toolbar (`frontend/src/components/ChatArea.tsx`):**
   - Bookmark button with active (amber filled) and inactive states.
   - Quick-copy button for message text.
   - Click handler toggles bookmark state, saves/deletes `.md` file, and updates live bookmark set.

2. **Sidebar Navigation (`frontend/src/components/Sidebar.tsx`):**
   - New `Bookmarks` button with bookmark icon and active count badge.
   - Positioned alongside Artifacts, Skills, and Messaging.

3. **Top Header Bar (`frontend/src/components/Header.tsx`):**
   - Direct `Bookmarks` button with count badge in the header bar.
   - `Saved Bookmarks...` item in the Settings & Tools dropdown menu.

4. **Master-Detail Bookmarks Page (`frontend/src/components/BookmarksPage.tsx`):**
   - **Dedicated Workspace View:** Rendered as a full-page view rather than a floating pop-up modal, maintaining full viewport responsiveness.
   - **Top Navigation:** Bookmark note count, file path reference (`backend/bookmarks/`), refresh button, and "Back to Chat" quick return.
   - **Search:** Real-time full-text search across titles, contents, and filenames.
   - **Filters:** Filter by role (`All`, `Assistant`, `User`).
   - **Preview:** Rich Markdown rendering using `react-markdown` and `remark-gfm` with formatted/raw source toggle.
   - **Actions:** Quick copy, download `.md` file, delete bookmark, or jump directly into the original chat session.

