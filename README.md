# Multi-Agent Personal Assistant

A sophisticated, multi-modal orchestration system that uses both Google Gemini (Flash 2.0) and local Ollama (Gemma) to browse the web, edit files, and manage tasks.

## 🚀 Features
- **Dual-Provider Orchestration:** Seamlessly switch between Gemini and Ollama for tool calling.
- **Vercel Agent Browser Integration:** Full support for the complete `agent-browser` command set (open, click, type, screenshot, etc.).
- **Visual Feedback:** Real-time screenshot delivery directly into the chat UI.
- **Log Explorer:** A dedicated sidebar to monitor agent thoughts, tool calls, and telemetry (tokens, context).
- **Multi-Agent Spawning:** The Orchestrator can delegate complex tasks to specialized sub-agents.
- **Persistent Memory:** SQLite-backed conversation history.
- **Session Control:** Clear history instantly using the `/new` command.

## 🛠️ Tech Stack
- **Backend:** Node.js, Express, Socket.io, SQLite, Ollama SDK, Google GenAI SDK.
- **Frontend:** React, Vite, TailwindCSS, React Markdown, Lucide Icons.
- **Automation:** `agent-browser` (Vercel).

## 🏃 Running Locally

### 1. Backend
```bash
cd backend
npm install
# Ensure .env is configured with GEMINI_API_KEY
node index.js
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📖 Browser Command Guide
The agent uses `agent-browser` for all web interactions. 
- **Important:** Use `snapshot` for AI reasoning and `screenshot` for visual output.
- **Workflow:** `open <url>` -> `snapshot` -> `screenshot`.

## 🤖 Decision Matrix
The system uses a formal delegation framework:
- **Atomic Tasks:** Handled directly by the Orchestrator.
- **Complex Research:** Delegated via `spawn_agent`.
