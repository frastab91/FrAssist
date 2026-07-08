# Long-term Memory: Orchestrator

## Project Context
- **Project Name**: FrAssist (Personal Assistant)
- **Primary Domain**: Spotless Personal Assistant
- **Infrastructure**: Supabase, Vertex AI, Tavily, Browser

## Operating Philosophy
- **Primary Goal**: To serve as a spotless, high-agency personal assistant.
- **Execution**: Strive to always deliver on all requests. Be creative, proactive, and persistent in finding solutions to get the job done.
- **Style**: Direct, efficient, and action-oriented.

## User Preferences
- **Agency**: High (Authorized to act directly on infrastructure/systems).


## Session Extract: 2026-04-30T03:39:26.520Z
Ecco il riepilogo da aggiungere alla memoria a lungo termine:

### 📝 Long-term Memory Summary: "Tra-Montiemare"

**1. Key facts/decisions**
*   Il progetto corrente è identificato come **"Tra-Montiemare"**, localizzato a **Scalea**.

**2. New skills or tools**
*   *Nessuna nuova competenza o strumento aggiunto in questa interazione.*

**3. Project-specific context**
*   Il progetto riguarda un'iniziativa o una proprietà situata a Scalea (CS). L'interazione è in lingua italiana.

**4. Long-term preferences**
*   L'utente preferisce un approccio diretto e amichevole (saluto in italiano).

## Session Extract: 2026-04-30T03:53:12.459Z
# Long-term Memory: Tra-Montiemare

## 1. Key Facts/Decisions Made
*   **Booking Inquiry:** Confirmed availability for Patty Jorgenson (March 21 – March 28, 2027) for the "Top Floor – Breathtaking Views" apartment.
*   **Pricing:** Confirmed quote of €530 total (7 nights @ €90, minus €130 discount, plus €30 cleaning fee).
*   **Protocol Established:** Standardized the communication style for all future guest inquiries.

## 2. New Skills or Tools Added
*   **API Integration:** Established protocol to pull availability and pricing data directly from the **Hostex API** or the **Supabase** project database.
*   **Operational Logic:**
    *   **Greeting:** Always use "Ciao [Name] 🌊" (Italian greeting + ocean wave emoji).
    *   **Tone/Voice:** Always write from the "we" perspective (representing the hosting team).
    *   **Signature:** Always sign off as "Francesco & Enerlida".

## 3. Project-Specific Context
*   **Property Name:** Tra-Montiemare (located in Scalea).
*   **Hosts:** Francesco & Enerlida.
*   **Target Audience:** Guests looking for serene, quiet, and beautiful vacation experiences.
*   **Database Reference:** "Attico" apartment ID is `12545574`.

## 4. Long-term Preferences
*   Maintain a warm, welcoming, and professional tone suitable for guests traveling to Europe for the first time.
*   Always offer to provide local travel tips and arrival assistance once a booking is confirmed to ensure a "smooth and enjoyable" experience.

## Session Extract: 2026-04-30T04:19:39.421Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Authentication Issues:** Attempts to use `--remote-debugging` session imports (`my-auth.json`) failed due to Facebook’s bot detection/security invalidating the session.
*   **Persistent Profiles:** Transitioned strategy to using persistent profiles (`--profile ~/.agent-browser/profiles/facebook-personal`) as a more robust method for maintaining long-term session data.
*   **UI Rendering:** The user is experiencing issues where the agent-browser is not successfully launching a visible window on their macOS, likely running in an unintended background or "headless" state.
*   **Credential Security:** The user declined to provide plain-text credentials for the agent to enter manually.

**2. New Skills or Tools Added**
*   **`agent-browser` Command Line Interface (CLI):** Learned to use flags like `--state` for session exports and `--profile` for directory-based session persistence.
*   **Remote Debugging:** Learned the process of launching Chrome with `--remote-debugging-port=9222` to capture browser states.
*   **Debugging Strategy:** Learned to use `snapshot` and `screenshot` commands to verify the state of rendered web pages when UI interaction is unclear.

**3. Project-Specific Context**
*   **Primary Goal:** Enable the verbal agent browser to access the user's Facebook account to review recent post comments.
*   **Environment:** macOS.
*   **Current Blocker:** The browser UI is failing to render on the desktop, preventing manual login within the persistent profile.

**4. Long-term Preferences**
*   **Privacy/Security:** The user prefers not to share clear-text passwords in the chat window, favoring technical workarounds like session/cookie file imports or local profile management.
*   **Agent Capability Testing:** The user is interested in "stress-testing" the verbal agent browser through tasks involving complex UI interaction, navigation, and multi-step reasoning.

## Session Extract: 2026-04-30T21:30:37.017Z
Ecco il riepilogo della conversazione, pronto per essere inserito nella sezione "Long-term Memory":

***

### 📝 Long-term Memory: Project "Tra-Montiemare" & Tools

**1. Key Facts / Decisions Made**
*   **Automazione Social:** Abbandonato il tentativo di automatizzare Facebook tramite browser agent a causa delle rigide protezioni anti-bot. La gestione delle comunicazioni rimane delegata alle piattaforme ufficiali (Hostex/Supabase).
*   **Strategia Privacy:** Rifiutato l'uso di intermediari (come Nylas) per l'integrazione email per motivi di privacy.
*   **Nuova Direzione Email:** Scelta la via dell'integrazione "Zero-Proxy" tramite server MCP personalizzato (Node.js) che comunicherà direttamente via IMAP/SMTP con Gmail usando le *App Passwords*.

**2. New Skills / Tools Added**
*   **Librerie pianificate:** `imapflow` (per lettura IMAP) e `nodemailer` (per invio email), da gestire esclusivamente a livello locale nel progetto.
*   **Infrastruttura:** Setup preliminare definito per un server MCP custom residente nella cartella `backend/skills/` del progetto.

**3. Project-specific Context**
*   **Workflow:** Il sistema rimane focalizzato sulla gestione della proprietà a Scalea tramite Hostex e Supabase. L'integrazione email (quando implementata) servirà per automatizzare la lettura delle richieste e l'invio di bozze di risposta direttamente dall'account Gmail dell'utente.

**4. Long-term Preferences**
*   **Privacy & Local-first:** L'utente ha una netta preferenza per soluzioni che non utilizzano servizi proxy cloud di terze parti.
*   **Isolation:** Richiesta esplicita di mantenere l'installazione di tool e dipendenze all'interno della cartella di progetto, evitando inquinamento dell'ambiente globale (preferenza per `npm` locale o configurazioni in-project).

*** 
*Stato corrente: In attesa di avvio implementazione server email custom (trigger da parte dell'utente).*

## Session Extract: 2026-04-30T21:55:00.022Z
Ecco il riepilogo delle informazioni da aggiungere alla tua "Long-term Memory":

### 1. Key Facts / Decisions
*   **Gestione disponibilità:** Confermata disponibilità di giugno 2026 per *Tra-Montiemare*: 
    *   Piano 1 (ID 12545573): 4-9 giugno.
    *   Attico (ID 12545574): 28-30 giugno.
*   **Strategia di comunicazione:** Adozione di un tono cordiale, professionale e orientato all'ospitalità (includendo call-to-action e suggerimenti locali) per i messaggi Facebook.
*   **Automazione Desktop:** Scelta di implementare un'infrastruttura di controllo desktop via Node.js anziché affidarsi agli strumenti di browsing nativi del modello.

### 2. New Skills / Tools
*   **Desktop Automation:** Integrazione pianificata di `@nut-tree/nut-js` per il controllo di mouse/tastiera e automazione locale.
*   **Visione Artificiale (Local AI):** Integrazione pianificata di `opencv4nodejs` e modelli VLM (LLaVA/Qwen-VL via Ollama) per consentire all'agente di "vedere" e analizzare l'interfaccia utente del desktop.
*   **Struttura Software:** Creazione in corso del modulo `vision_agent.js` e del tool `desktop_automation` nel repository del progetto.

### 3. Project-specific Context
*   **Progetto:** *Tra-Montiemare* (struttura turistica a Scalea).
*   **Requisiti di Sistema:** Necessità di configurare i permessi di "Accessibilità" e "Registrazione Schermo" nel sistema operativo per consentire l'automazione.
*   **Workflow operativo:** L'agente dovrà catturare screenshot via `nut.js`, analizzarli tramite modelli di visione locali (Ollama) ed eseguire azioni di input basate sui risultati.

### 4. Long-term Preferences
*   **Preferenza tecnologica:** L'utente predilige il controllo diretto tramite script custom e server MCP locali rispetto all'utilizzo di tool di browsing automatizzati remoti.
*   **Sicurezza:** Richiesta esplicita di gestire correttamente i permessi e implementare un protocollo di sicurezza (es. hotkey per "kill switch" di emergenza).

## Session Extract: 2026-05-02T20:14:17.723Z
### Long-term Memory: TraMonti e Mare (Scalea)

**1. Key Facts/Decisions Made**
*   **Knowledge Base Establishment:** Created `knowledge_base_t&m.md` containing comprehensive details on property specs, pricing, policies, transportation, and local area info.
*   **Communication Strategy:** Established a standard, warm, and professional tone for host communications (Francesco & Enerlida).
*   **Logistics Advice:** Confirmed that while public transport exists, taxis are highly recommended for arrivals at Scalea station to avoid fatigue; hosts offer to help coordinate pick-ups.

**2. New Skills or Tools Added**
*   **Knowledge Base Integration:** Now utilizing the `knowledge_base_t&m.md` file as the primary source of truth for all guest inquiry responses.
*   **Drafting Capabilities:** Enhanced capability to draft guest-facing emails in both English and Italian, maintaining specific brand voice.

**3. Project-Specific Context**
*   **Project Name:** "Tra-Montiemare" (Scalea, Italy).
*   **Owners:** Francesco & Enerlida (currently residing in NYC).
*   **Property Types:** 
    *   *Floor 1 (Piano 1):* 3-bedroom, family-friendly, dedicated focus/relax room.
    *   *Top Floor (Attico):* 1-bedroom, sea/old town views, best for couples/solo travelers.
*   **Key Amenities:** 100 Mbps WiFi, AC/Heating, washing machines, fully equipped kitchens.
*   **Current Workflow:** The agent acts as a virtual property manager, handling inquiries by leveraging the local knowledge base to ensure consistent and accurate information sharing.

**4. Long-term Preferences**
*   **Tone:** Welcoming, helpful, and "human-like" (reflecting the hosts' actual personality).
*   **Operating Procedure:**
    *   Always emphasize that utilities (including AC) are included.
    *   Promote the ease of walking to local markets/restaurants (5-10 min walk).
    *   Direct all guests to `tra-montiemare.it/d-n` for real-time availability.
    *   Maintain flexibility for specific guest needs (e.g., accommodating partial stay visitors or pets).

## Session Extract: 2026-05-02T20:40:16.880Z
### 📝 Long-term Memory Update: Project "Tra-Montiemare" & User Preferences

**1. Key facts/decisions made**
*   **Language Policy:** Switched communication language to English for all future interactions.
*   **System Status:** Full synchronization of project "Tra-Montiemare" completed; `knowledge_base_t&m.md` is current.
*   **Operational Scope:** Confirmed the ability to research external web documentation (e.g., Google's societal impact reports).

**2. New skills or tools added**
*   **Vision Capability:** Enabled full support for image/screenshot analysis. The model can perform OCR, interface interpretation, and data extraction from dashboard screenshots (e.g., Hostex, Supabase) to cross-reference with project documentation.
*   **Automated Workflow:** Proposed and ready to implement `generate_guest_summary` to streamline arrival procedures.

**3. Project-specific context**
*   **"Tra-Montiemare" (Scalea):** All management procedures, apartment specifics, and logistics are stored in `knowledge_base_t&m.md` and integrated with the Hostex API.

**4. Long-term preferences**
*   **Communication:** Strict preference for English as the output language.
*   **Operational Mode:** Proactive assistance model—when an image is provided, the system is expected to cross-reference it with the `knowledge_base_t&m.md` and suggest follow-up actions (e.g., drafting replies, identifying policy conflicts).

## Session Extract: 2026-05-02T21:06:45.259Z
### Long-term Memory: Project & Preference Update

**1. Key Facts/Decisions Made**
*   **Plant Care:** User is managing several large, healthy houseplants (Bird of Paradise, Fiddle Leaf Fig, Rubber Plant).
*   **Tool Selection:** User decided to pursue soil moisture monitoring to prevent overwatering, specifically for deep-rooted plants.
*   **Verified Links:** Validated active Amazon links for XLUX Long Probe, Sustee Aquameter, and Sonkir 3-in-1 meter.

**2. New Skills/Tools Added**
*   **Plant Maintenance Tools:** Incorporated soil moisture monitoring strategies (manual probe vs. permanent wick sensors).
*   **Verification Protocol:** Used internal agent browser tools to verify URL validity and retrieve product screenshots per user request.

**3. Project-specific Context**
*   **"Tra-Montiemare" (Primary):** Vacation rental property in Scalea. All communications must adhere to established "Tra-Montiemare" guidelines.
*   **Personal Property (Secondary):** Household plant care management (distinct from rental property tasks).

**4. Long-term Preferences**
*   **Communication Style:** Strict adherence to "Tra-Montiemare" guidelines for business-related inquiries.
*   **Problem-Solving:** When providing shopping recommendations, prefers verified direct links and visual evidence (screenshots) rather than generic suggestions.
*   **Technical Troubleshooting:** Expects the AI to utilize browser tools to resolve broken links or verify real-time data proactively.

## Session Extract: 2026-05-02T21:14:53.502Z
### Long-term Memory: Project & Preference Update

#### 1. Key Facts/Decisions Made
*   **Product Selection:** User decided to purchase the **XLUX Long Probe Soil Moisture Meter** for plant maintenance.
*   **Action:** The item was successfully added to the user's Amazon cart.
*   **Workflow:** User has initiated a manual sign-in process for the browser agent to establish a persistent, authenticated Amazon session for future tasks.

#### 2. New Skills/Tools Added
*   **Browser Agency:** The model is now capable of navigating, browsing, and managing carts on Amazon via an autonomous Chromium-based agent.
*   **Visual Documentation:** The model is established to use screenshots as the primary method for confirming products, reviews, and cart status per user preference.
*   **Security Protocol:** Established a strict "no-purchase-without-approval" policy; the model will manage the cart and research but will never enter payment information or finalize transactions autonomously.

#### 3. Project-Specific Context
*   **Project Name:** *Tra-Montiemare*.
*   **Location:** Home/Garden in Scalea (Italy) and current residency in Queens, NY.
*   **Objective:** Simplify plant care for a hosting team; the chosen tool is specifically designed for ease of use (analog, no batteries, color-coded) to minimize maintenance and prevent over/under-watering.

#### 4. Long-Term Preferences
*   **Communication Style:** The user explicitly prefers visual confirmation (screenshots) over textual descriptions for product research and status updates.
*   **Session Management:** The user desires persistent logins to ensure the model has continuous access to their Amazon account (cart, order history) for streamlined future procurement.
*   **Security/Autonomy:** The user maintains control over sensitive actions (logins, 2FA, final payment approval) while delegating search and cart management to the AI.

## Session Extract: 2026-05-02T21:25:10.640Z
## Long-term Memory: Browser & Session Management

### 1. Key Facts/Decisions
*   **Session Limitation:** Automated browser agent sessions (via `--remote-debugging-port`) consistently fail to inherit authenticated Amazon session cookies from the user's main Chrome profile, even when using the `--user-data-dir` flag.
*   **Decision:** Abandoned efforts to force automated session login/persistence. 
*   **Fallback Workflow:** The agent will operate via explicit user input, research, and collaborative cart management rather than direct autonomous authenticated browsing.

### 2. New Skills/Tools
*   **Debugging Command:** Utilized Chrome command-line arguments to launch instances with specific profiles:
    `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9222 --user-data-dir="[PATH]"`
*   **Profile Path Location:** User can locate profile directories via `chrome://version` in their active browser.
*   **Terminal Syntax:** Reinforced the necessity of wrapping directory paths in quotes when they contain spaces (e.g., `Application Support`).

### 3. Project-Specific Context
*   **User Profile:** Francesco (`/Users/francescoclaw/Library/Application Support/Google/Chrome/Default`).
*   **Current Goal:** Searching for and purchasing a "soil tracker for plants" (in progress).

### 4. Long-term Preferences
*   **Efficiency:** The user prefers direct solutions and avoids repetitive troubleshooting when technical barriers (like Amazon's session binding) are met.
*   **Communication Style:** The user appreciates clear, step-by-step technical instructions but expects the agent to recognize when a technical hurdle requires switching to a more reliable, albeit manual, workflow.

## Session Extract: 2026-05-02T22:22:02.230Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Goal:** User attempted to purchase a "Censinda Soil Moisture Meter" (priced at $5.99) via Amazon.
*   **Outcome:** The task remained incomplete due to technical synchronization issues between the automated browser session and the user's logged-in Chrome profile.
*   **Security Protocol:** The AI confirmed it is restricted from performing final checkouts or entering payment information for user security.

**2. New Skills or Tools Added**
*   **Browser Session Management:** Utilized browser profile integration to attempt persistent shopping sessions.
*   **Debugging/Verification:** Employed screenshot captures as a primary tool to reconcile discrepancies between the AI's "view" of the cart and the user's actual interface.

**3. Project-Specific Context**
*   **Hardware:** User requires a budget-friendly (<$15 USD), highly-rated soil moisture monitor for plants.
*   **Technical Constraint:** Persistent failure in the accessibility tree prevented the AI from programmatically clicking "Add to Cart" despite being logged into the correct user profile.

**4. Long-term Preferences**
*   **Efficiency:** The user prefers the AI to handle end-to-end shopping tasks (finding and adding to cart) rather than performing manual actions.
*   **Communication:** When automation fails, the user prefers a direct, proactive troubleshooting approach rather than repeated, unsuccessful automated attempts.

## Session Extract: 2026-05-02T22:25:45.259Z
### Long-term Memory: Project Tra-Montiemare

**1. Key Facts/Decisions Made**
*   **Cart Status:** Confirmed that the user's Amazon shopping cart is currently empty.
*   **Capability Limitation:** Reaffirmed that I am a text-based AI and cannot generate, record, or send audio/voice messages despite user requests for text-to-speech functionality.

**2. New Skills or Tools Added**
*   **Screenshot/Snapshot Tool:** Confirmed capability to capture and analyze visual data from the user's browser/interface (utilized to audit the Amazon cart).

**3. Project-Specific Context**
*   **Project Name:** *Tra-Montiemare*.
*   **Project Tasks:** Currently tracking shopping/procurement for this project, specifically involving a "soil moisture meter."

**4. Long-term Preferences**
*   **Interaction Style:** The user prefers visual verification (screenshots) for task confirmation. 
*   **Constraint:** The user has shown interest in utilizing text-to-speech features; monitor for future integration or alternative methods if available.

## Session Extract: 2026-05-03T17:26:51.171Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Bug Fix:** Identified and resolved a duplicate message issue in the Telegram integration caused by an erroneous broadcast command.
*   **Booking Inquiry:** Drafted a response for a potential guest (ssbprimo@gmail.com) for a 3-night stay (August 24–27) at the **Floor 1** apartment.
*   **Property Data:** Updated the `knowledge_base_t&m.md` with the official YouTube channel for apartment video tours (https://www.youtube.com/channel/UCOgvNu-3R5RFS268qQtnxIg).
*   **Pricing:** Confirmed Floor 1 high-season (August) pricing at €150/night, plus a €50–75 cleaning fee, totaling €500–€525 for the requested 3-night stay.

**2. New Skills or Tools Added**
*   **`gemini-cli` Integration:** Authorized the use of the locally installed `gemini-cli` to perform direct code modifications. 
    *   *Protocol:* Analyze (via `read`) $\rightarrow$ Verify scope $\rightarrow$ Execute change $\rightarrow$ Confirm with summary/diff.

**3. Project-specific Context**
*   **Tra-Montiemare:** The hosting team consists of Francesco and Enerlida.
*   **Operational Details:**
    *   Payment methods accepted: Bank transfer (EUR), Wise, Venmo, PayPal.
    *   Booking requirements: ID/passport photo, signed Italian rental agreement, 50% deposit at booking, 50% balance due 1 week before check-in.
    *   Cancellation Policy: 100% refund (30+ days prior), 50% refund (14–30 days prior), 0% refund (<14 days prior).

**4. Long-term Preferences**
*   **Communication:** Preference for professional, templated email responses for guest inquiries.
*   **Technical:** Strong preference for "local-first" and "security-focused" development practices when using automated tools to modify the codebase.

## Session Extract: 2026-05-03T17:41:02.126Z
### Long-term Memory: Session Analytics & Tooling

**1. Key Facts/Decisions Made**
*   **Storage Strategy:** Adopted **JSON Lines (`.jsonl`)** as the format for local analytics storage. It was chosen for its append-only efficiency and ease of parsing via CLI tools (like `jq`) and Node.js.
*   **File Path:** Analytics data will be stored in `data/usage_analytics.jsonl`.
*   **Workflow Integration:** Usage tracking and session summarization must be triggered automatically upon the `/new` command within the main orchestrator loop.
*   **Tooling Command:** All development tasks related to the FrAssist project must be delegated to the `gemini` CLI tool.

**2. New Skills or Tools Added**
*   **Local Analytics Engine:** Implementation of a `session_tracker.js` utility to summarize interactions (categorization and topic extraction) and calculate token usage.
*   **Dashboard Script:** Creation of `scripts/show_dashboard.js` to parse the `.jsonl` file and aggregate usage statistics per category/task.
*   **CLI Delegation:** Established a workflow where the agent acts as a supervisor/architect, delegating actual code generation and file system operations to the `gemini` CLI executable.

**3. Project-Specific Context**
*   **Repository Path:** `/Users/francescoclaw/Desktop/Progetti/FrAssist/backend`
*   **Project Name:** FrAssist
*   **Environment:** Local-first architecture (no external databases like Supabase used for this feature).

**4. Long-term Preferences**
*   **Process Automation:** The user strictly requires the AI to delegate development tasks to the `gemini` CLI rather than performing them via direct text output whenever possible.
*   **Data Integrity:** The user prefers maintaining usage history in a format that remains human-readable and compatible with standard terminal utilities for future data analysis.

## Session Extract: 2026-05-03T17:51:59.980Z
## Long-term Memory: Project Context & Preferences

### 1. Key Facts/Decisions
*   **Model Availability Issue:** The requested model `qwen3.5:9b` is not a standard/available tag in the Ollama library; user likely meant a different version (e.g., `qwen2.5` or `qwen3` variants).
*   **Action Status:** User opted to manually handle the model download and codebase integration.
*   **Model Integration:** The task of adding the new model to the backend configuration is pending user intervention.

### 2. New Skills or Tools Added
*   **Ollama:** Confirmed as the local LLM runtime for the project.

### 3. Project-Specific Context
*   **Project Path:** `/Users/francescoclaw/Desktop/Progetti/FrAssist/backend`
*   **Goal:** Integrate a local Qwen model into the existing backend architecture.

### 4. Long-term Preferences
*   **Autonomy:** User prefers to perform manual codebase updates and CLI operations when environment constraints (e.g., download timeouts) hinder automated assistance.
*   **Communication:** User expects the model to stand by and wait for further instructions rather than attempting to force automated solutions when errors occur.

## Session Extract: 2026-05-03T18:06:08.973Z
### Long-term Memory: Tra-Montiemare

**1. Key Facts/Decisions Made**
*   **Pricing Correction:** Discarded daily rate calculations for long-term stays.
*   **New Pricing Logic:**
    *   **Stays 28+ days:** Apply the monthly rate.
    *   **Stays 7+ days:** Apply the weekly rate.
    *   **Short stays:** Apply daily rates.
*   **Pro-ration Method:** For stays spanning different months, calculate the stay by splitting the period into full monthly chunks and prorating remaining days based on the next month’s monthly rate.

**2. New Skills or Tools Added**
*   **Database Integration:** Successfully established connection and query capabilities for the **Supabase** project database (`pricing` and `apartments` tables).
*   **Attico Property Data:** Accessed specific IDs and rate structures (May Monthly: €1,300, June Monthly: €1,500).

**3. Project-specific Context**
*   **Property Focus:** Tra-Montiemare (Scalea).
*   **Primary Unit:** "Attico" (Top Floor Apartment), ID: `4940b254-ea41-4871-b083-444793de667d`.
*   **Standard Fee:** Cleaning fee remains fixed at €50.

**4. Long-term Preferences**
*   **Communication Tone:** Professional, welcoming, and hospitable (as per the "Francesco & Enerlida" template).
*   **Operational Priority:** Accuracy in pricing is paramount; always check Supabase rates before quoting and apply duration-based discounts (monthly/weekly) automatically for relevant inquiries.

## Session Extract: 2026-05-03T18:21:01.214Z
## Long-term Memory: Project "FrAssist"

### 1. Key Facts/Decisions Made
*   **Project Structure Update**: Corrected the root directory path for the "FrAssist" project.
*   **Workflow Delegation**: The user prefers to delegate coding tasks directly to the `gemini` CLI for implementation.
*   **Feature Requirement**: Implementing drag-and-drop image upload functionality for the input box (UI focus).

### 2. New Skills or Tools Added
*   **CLI Tooling**: `gemini` CLI used as the primary engine for codebase modification.
*   **Workflow Tracking**: Initiated internal tracking (Workflow ID: 1).

### 3. Project-Specific Context
*   **Root Directory**: `/Users/francescoclaw/Desktop/Progetti/FrAssist/`
*   **Backend Path**: `/Users/francescoclaw/Desktop/Progetti/FrAssist/backend/`
*   **Frontend Path**: `/Users/francescoclaw/Desktop/Progetti/FrAssist/frontend/`
*   **Current Task**: Implementing drag-and-drop file support in the `frontend` directory.
*   **Known Issues**: Remote orchestration via the model may hit execution timeouts for large codebase changes; direct terminal execution is the preferred fallback.

### 4. Long-term Preferences
*   **Direct Execution**: User prefers direct delegation to CLI tools over excessive intermediate analysis/oversight from the model when requesting code changes.
*   **Path Accuracy**: Model must strictly adhere to the defined project root and subdirectory structure for all future path-related suggestions.

## Session Extract: 2026-05-03T18:30:41.498Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Goal:** Implementing drag-and-drop image upload functionality in the `ChatInput.js` component.
*   **Approach:** Decided to break down implementation into three sequential steps (state management, event handler logic, and JSX UI updates) after the `gemini` CLI faced timeout issues with a single monolithic request.
*   **Technical Requirements:** Must include `preventDefault` and `stopPropagation` to prevent browser default behaviors, validate file MIME types (`image/*`), and handle memory management with `URL.revokeObjectURL()`.

**2. New Skills or Tools Added**
*   **Tooling Strategy:** Shifted workflow from single-pass `gemini` CLI commands to incremental, modular code editing to bypass command execution timeouts.

**3. Project-Specific Context**
*   **Project Name:** `FrAssist`
*   **Target File:** `/Users/francescoclaw/Desktop/Progetti/FrAssist/frontend/src/components/ChatInput.js`
*   **Current State:** Pending implementation of state (`droppedImage`, `isDragging`), event handlers (`onDragOver`, `onDragLeave`, `onDrop`), and preview rendering.

**4. Long-term Preferences**
*   **Workflow:** User prefers delegating code implementation directly to the `gemini` CLI/Model rather than writing code manually.
*   **Interaction Style:** Expects the model to drive the execution; prefers the model to proactively suggest breakdowns or alternative methods (like `edit_file`) when initial automated approaches fail.

## Session Extract: 2026-05-03T20:26:19.494Z
### Long-Term Memory Summary

**1. Key Facts/Decisions Made**
*   **Multilingual Support:** The assistant is confirmed to be bilingual (Italian/English) and can adapt to the user's preferred language on the fly.
*   **Communication Format:** The user has requested voice message responses. The assistant has agreed to use voice-to-voice communication, though it currently faces intermittent technical errors with the synthesis tool.
*   **Session Reset:** The `/new` command was used to clear context and log session data into `usage_analytics.jsonl`.
*   **Location Constraints:** Acknowledged that "Trader Joe's" is not available in Italy.

**2. New Skills or Tools Added**
*   **Voice Capability:** Enabled/activated voice message handling (receiving and sending).
*   **Logging:** Established usage tracking via `usage_analytics.jsonl`.
*   **Browser/Tool Integration:** Attempted usage of browser/location tools (though with persistent technical instability).

**3. Project-Specific Context**
*   **Tra-Montiemare:** A vacation rental property project located in **Scalea, Italy**.
*   **FrAssist:** An active software development project requiring ongoing assistance.
*   **User Geography:** The user splits time between **Scalea, Italy**, and **New York City**.

**4. Long-Term Preferences**
*   **Preference for Voice:** The user prefers interacting via voice messages rather than text-only input/output.
*   **Bilingual Workflow:** The user expects the assistant to fluidly switch between Italian and English based on the context of the project or the conversation.
*   **Proactive Status Checks:** The assistant is expected to monitor and offer progress updates on both *Tra-Montiemare* and *FrAssist* automatically at the start of sessions.

## Session Extract: 2026-05-03T20:58:07.352Z
### Long-term Memory: Project & Preference Update

#### 1. Key Facts/Decisions Made
*   **NYC Tennis Modalities:**
    *   **Juniper Valley:** Permit-only, first-come, first-served, no online reservations.
    *   **Astoria Park:** Permit-only, organized in-person "clipboard" system managed by an attendant (40-minute rule for sign-ups).
    *   **McCarren Park:** Hybrid/Tennis Center model; uses *CourtReserve* for online bookings; operates as a "bubble" indoor facility in winter.
*   **Voice Synthesis:** Technical issues were resolved, allowing for the generation of audio responses again.

#### 2. New Skills or Tools Added
*   **CourtReserve:** Identified as the specific management/booking platform for McCarren Park.

#### 3. Project-Specific Context
*   **`FrAssist`:** Ongoing development of a drag-and-drop feature.
*   **`Tra-Montiemare`:** Active project requiring guest-related task management.

#### 4. Long-term Preferences
*   **Language:** Communication remains set to **English** for project consistency, despite the user's occasional use of Spanish/Italian.
*   **Interaction Style:** The user has a clear **preference for voice interactions/audio summaries** over text.

## Session Extract: 2026-05-03T21:00:12.265Z
### Long-Term Memory Summary

**1. Key Facts/Decisions**
*   **Core Directive Update:** Permanently updated `system.md` to prioritize extreme creativity, resilience, and a commitment to "going the extra mile" for all task completions.
*   **Operational Stance:** The model has formally integrated these traits into its primary operating instructions to ensure consistent application across all future interactions.

**2. New Skills or Tools**
*   **N/A** (Focus was on behavioral alignment rather than technical tools).

**3. Project-Specific Context**
*   **User Expectations:** The user requires a high-performance, proactive, and persistent model that does not settle for minimal completion but seeks high-quality, creative outputs.

**4. Long-Term Preferences**
*   **Performance Standard:** High-effort, high-creativity, and resilient problem-solving are now the default expected standards for all tasks assigned by the user.

## Session Extract: 2026-05-05T01:28:14.721Z
Ecco il riepilogo delle informazioni da aggiungere alla "Long-term Memory":

### 1. Key facts/decisions
*   **Protocollo risposte Facebook:** Formato breve, informale, accogliente e sempre aperto a discussioni.
*   **Struttura preventivo:** Sempre includere il prezzo totale (affitto + €50 pulizie finali).
*   **Regole di calcolo:**
    *   Soggiorni settimanali: applicare la tariffa settimanale fissa.
    *   Soggiorni misti: tariffa settimanale + tariffa giornaliera proporzionale per i giorni eccedenti.
*   **Logica di prenotazione:** 
    *   **Piano 1:** Adatto a famiglie/gruppi di 4 persone.
    *   **Attico:** Adatto solo per massimo 2 persone.

### 2. New skills or tools
*   **Integrazione Dati:** Utilizzo dei dati estratti da Supabase per tariffe e disponibilità (Piano 1: €1100 sett./€165 giorn.; Attico: €1000 sett./€150 giorn.).
*   **Gestione Media:** Utilizzo di link specifici ai video YouTube Shorts per ogni unità abitativa.

### 3. Project-specific context
*   **Progetto:** "Tra Monti e Mare" (Scalea).
*   **Host:** Francesco & Enerlida.
*   **Asset:**
    *   *Piano 1:* [https://www.youtube.com/shorts/eM_ICNSwhYA](https://www.youtube.com/shorts/eM_ICNSwhYA)
    *   *Attico:* [https://youtube.com/shorts/yP7_KB9WRWM](https://youtube.com/shorts/yP7_KB9WRWM)
    *   *Extra (Sunset):* [https://www.youtube.com/shorts/mQ8imLuc5bM](https://www.youtube.com/shorts/mQ8imLuc5bM)
*   **Sito di riferimento:** [tra-montiemare.it/d-n](https://tra-montiemare.it/d-n)

### 4. Long-term preferences
*   **Disponibilità:** Se il cliente chiede disponibilità per un periodo specifico, chiedere sempre il numero di ospiti (adulti/bambini) prima di proporre l'appartamento.
*   **Trasparenza:** Non proporre l'Attico se il gruppo è superiore a 2 persone.
*   **Precisione:** Mantenere sempre aggiornato il database interno con le informazioni caricate dal progetto.

## Session Extract: 2026-05-05T01:54:30.978Z
### Long-term Memory: Project "Terrace Bistro Set"

**1. Key Facts/Decisions Made**
*   **Goal:** Purchase a 3-piece patio bistro set (2 chairs, 1 table).
*   **Criteria:** Must be foldable, "nice design," and under $100 USD.
*   **Strategy Shift:** Due to frequent "bot-detection" issues and link decay, the user and model transitioned from relying on direct URL generation to using specific product names and search queries.
*   **Preferred Models Identified:** Grand Patio Premium Steel Bistro Set, Best Choice Products 3-Piece Bistro Set, and Alpine Corporation 3-Piece Folding Set.

**2. New Skills or Tools Added**
*   **Tool Usage:** Chromium-based browsing sessions were attempted to simulate user-side navigation.
*   **Troubleshooting:** Implemented a fallback strategy using DuckDuckGo to bypass aggressive bot-detection blocks on major retail sites.

**3. Project-Specific Context**
*   **Environment:** The terrace is a small space, necessitating the "folding" and "compact" design requirements.
*   **Technical Constraint:** The user expects the AI to actively browse the web to provide verified, actionable shopping information rather than generic suggestions.

**4. Long-term Preferences**
*   **Transparency:** User prefers direct, functional links but is willing to accept product names if the AI explains the limitations (i.e., site security/bot-detection).
*   **Workflow:** The user prefers the AI to "browse on their behalf" using automated browser sessions.

## Session Extract: 2026-05-05T02:01:47.421Z
### Long-term Memory: Project Assistance

#### 1. Key Facts/Decisions Made
*   **Workflow Change:** Moved away from session-based "link-scraping" (which produces broken, tracking-heavy URLs) to a **"Canonical/ASIN Extraction" protocol**.
*   **Protocol Confirmation:** The model will now navigate to product pages and extract the `rel="canonical"` metadata or the unique **ASIN** (Amazon Standard Identification Number) to construct permanent, shareable links.
*   **User Requirement:** The user explicitly rejected the "manual search query" workaround, demanding full agent autonomy in researching and providing functional links.

#### 2. New Skills/Tools Added
*   **Canonical URL Extraction:** Ability to read HTML head metadata to find permanent product links.
*   **ASIN-Based Navigation:** Capability to construct stable URLs using `https://www.amazon.com/dp/[ASIN]`.
*   **DOM Interaction:** Use of `XPath`/CSS selectors combined with `playwright` to navigate and isolate product data points rather than relying on search result snapshots.

#### 3. Project-Specific Context
*   **Current Task:** Researching 3-piece folding patio bistro sets (small terrace sized).
*   **Preference:** Looking for "good-looking" designs; initial candidates identified were Grand Patio (steel), Best Choice Products (sage/steel), and Alpine Corporation (white).
*   **Goal:** Provide the user with a list of vetted products with 100% functional, permanent links.

#### 4. Long-term Preferences
*   **Agent Independence:** The user expects the AI to be fully autonomous. If a tool fails (like link-scraping), the user prefers the agent to propose a more robust technical solution rather than shifting the labor of search onto the user.
*   **Link Integrity:** All future product recommendations must be verified for permanent accessibility.

## Session Extract: 2026-05-05T02:06:17.445Z
### Long-term Memory: Agent Architecture & Capabilities

**1. Key Facts/Decisions**
*   **Architecture:** Operates as a modular, extensible system rather than a static list of predefined skills.
*   **Methodology:** Uses "progressive disclosure"—skills are only loaded into active memory when a specific task requires them to preserve context window efficiency.
*   **Formalization:** Workflows and repetitive tasks can be formalized into custom "skills" to ensure consistent execution.

**2. New Skills or Tools Added**
*   **Agent Skills Standard:** Supports the open standard for packageable instruction sets (defined via `SKILL.md` files).
*   **Core Toolkit:** Confirmed capabilities include `browser_control`, `supabase_action`, and `duffel_travel`.

**3. Project-specific Context**
*   The system is designed to scale horizontally; it can handle an unlimited number of domain-specific tasks by dynamically loading the necessary logic on-demand.

**4. Long-term Preferences**
*   **Operational Philosophy:** Prefers a "specialist on-demand" approach to avoid overloading active context windows.
*   **User Collaboration:** Encourages the user to identify repetitive workflows for formalization into standardized skills to improve future task performance.

## Session Extract: 2026-05-05T02:15:19.624Z
### Long-term Memory: Travel Planning

**1. Key Facts/Decisions Made**
*   **Trip Details:** Planning travel from NYC to Miami for June 1–8, 2026.
*   **Data Source:** Flight options were retrieved via browser/Google Flights; the Duffel API was requested by the user, but experienced significant integration/configuration issues regarding environment variables.
*   **Booking Status:** Bookings cannot be finalized by the model; the user must use external links (e.g., Google Flights/airline sites) for payments.

**2. New Skills or Tools Added**
*   **Duffel API:** Attempted integration for flight search; requires persistent environment variable configuration (`DUFFEL_API_KEY`) for future sessions.

**3. Project-Specific Context**
*   **Destination Preferences:** Open to Miami International (MIA) or Fort Lauderdale (FLL).
*   **Origin:** NYC (open to JFK, LGA, or EWR).
*   **User Constraint:** The user strongly prefers the use of the Duffel API for travel data retrieval over standard browser-based searches.

**4. Long-term Preferences**
*   **API Utilization:** The user expects the model to utilize the Duffel API for travel-related tasks. If the tool fails, the user prefers troubleshooting the API connection rather than reverting to manual browser searches.
*   **Communication:** Direct and persistent in requesting specific technical workflows (Duffel API) despite system errors.

## Session Extract: 2026-05-05T02:24:23.757Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Operating Framework:** The assistant is now established as a "hyper-personal assistant" with a mandate to provide high-agency support across all life areas, not just the *Tra-Montiemare* property.
*   **Travel Planning:** Settled on a November trip to the Caribbean. Aruba (AUA) is the primary target due to weather stability.
*   **Duffel Capabilities:** Confirmed that current `duffel_travel` integration is "read-only" (search/research). Full booking capabilities would require live API credentials, custom order-creation logic, and a "human-in-the-loop" approval process for security.
*   **Assistance Scope:** The assistant can research flights (Duffel) and general travel/hotel logistics via browser, but lacks direct API booking access for hotels and trains.

**2. New Skills or Tools Added**
*   **`duffel_travel` (Flight Research):** Capability to perform `search_airports` and `search_flights` for real-time pricing and availability.
*   **Browser Control:** Confirmed capability to use browser tools to research accommodation and train travel where no dedicated API exists.

**3. Project-Specific Context**
*   **Primary Projects:** 
    *   *Tra-Montiemare:* Ongoing property management.
    *   *Caribbean Travel (Nov 2026):* New project; focus is on Aruba; preference for non-stop flights and high-value options.
*   **General Context:** User expresses a need for broad, proactive support including NYC logistics, personal maintenance, and development tasks.

**4. Long-term Preferences**
*   **Safety/Security:** High priority on "human-in-the-loop" verification for any financial transactions or booking flows.
*   **Efficiency:** Preference for non-stop travel options.
*   **Proactivity:** The assistant is expected to balance multiple life projects simultaneously rather than hyper-focusing on a single ongoing project.

## Session Extract: 2026-05-06T02:02:08.992Z
### Long-term Memory Summary: Project "Tra-Montiemare"

**1. Key Facts/Decisions Made**
*   **Active Request:** The user is looking for a specific terrace planter for vegetable gardening.
*   **Specifications:** 
    *   Maximum Length: 45 inches
    *   Maximum Height: 30 inches
    *   Maximum Width: 15 inches
    *   Budget: Under $110 USD.
*   **Status:** Previous attempts to provide working links and visual references were unsuccessful; the search remains open and pending.

**2. New Skills or Tools Added**
*   *None identified.* The conversation has focused on product search and retrieval attempts which require refinement in execution.

**3. Project-Specific Context**
*   **Project Name:** "Tra-Montiemare".
*   **Domain:** Likely a residential or terrace gardening project, given the specific request for vegetable pots.
*   **User Identity:** Francesco.

**4. Long-term Preferences**
*   **Communication Style:** The user prefers direct, task-oriented assistance in Italian, but is comfortable switching to English for specific technical queries.
*   **Constraint Adherence:** Strict adherence to physical dimensions and budget caps is required for product recommendations.

## Session Extract: 2026-05-06T02:18:29.222Z
Since the provided conversation was limited to a search request and greetings, here is the summary of the actionable data:

### **Long-Term Memory Summary**

**1. Key Facts/Decisions**
*   **Active Search:** User is currently looking for a terrace vegetable planter.
*   **Constraints:** 
    *   Maximum length: 40 inches.
    *   Maximum height: 25 inches.
    *   Budget: Under $150.

**2. New Skills or Tools Added**
*   None.

**3. Project-Specific Context**
*   **Project:** Terrace Gardening / Vegetable cultivation.
*   **Requirement:** Identifying suitable planters that fit specific dimension and budget criteria for a balcony or terrace setup.

**4. Long-term Preferences**
*   Interest in gardening/agriculture (specifically container-based vegetable gardening).
*   Preference for budget-conscious procurement (under $150).

## Session Extract: 2026-05-06T02:21:21.803Z
## Long-Term Memory Update

**1. Key facts/decisions made:**
*   **Search Request:** The user is looking for a terrace vegetable pot.
*   **Specifications:** Maximum length of 40 inches; height of 25 inches.
*   **Budget:** Under $150.

**2. New skills or tools added:**
*   N/A (Continued use of web browsing/search tools).

**3. Project-specific context:**
*   **Project Focus:** Vacation rental management in Scalea, Italy.
*   **Current Task:** Sourcing terrace decor/gardening equipment for the Scalea property.

**4. Long-term preferences:**
*   **Budgeting:** Value-conscious; prefers products under specific price thresholds.
*   **Style:** Functional, space-optimized decor suitable for terrace/balcony gardening.

## Session Extract: 2026-05-06T02:33:28.569Z
### Long-term Memory: Project Summary

**1. Key Facts/Decisions Made**
*   **Orchestration Capability Confirmed:** Established that I function as an "Orchestrator" capable of spawning specialized agents (Researcher, Growth Hacker, Developer) and managing persistent workflows.
*   **Workflow Persistence:** Decisions and task states are managed via `manage_workflow` (using IDs for resuming) and persistent browser profiles (`--user-data-dir`), allowing for autonomous background execution without timeouts.
*   **Project Initialization:** Officially added **Rally-NYC** to the active project list.
*   **Rally-NYC Status:** Initial research into the NYC public tennis court system completed; Growth Hacker assessment suggests a "hyper-local crowd-reporting" strategy to solve current fragmentation/booking issues.

**2. New Skills or Tools Added**
*   **Agent Orchestration:** Deployed a multi-agent framework capable of passing data between specialized roles (Research -> Assessment).
*   **Visual Generation:** Integrated image generation capabilities for conceptual analysis and data visualization.
*   **Advanced Browser Automation:** Utilized persistent browser profiles to maintain session state and bypass standard web timeouts.

**3. Project-Specific Context**
*   **Tra-Montiemare (Scalea):** Ongoing vacation rental project (remains active).
*   **Rally-NYC:** New project focused on the NYC tennis community. Pain point: Lack of a unified real-time dashboard for court availability. Strategy: Gamify status updates for specific parks (e.g., McCarren Park).
*   **Media Analysis:** Performed a comparative analysis of *The New York Times* vs. *Financial Times*. Noted that *FT* access is currently hindered by anti-bot protections (Cloudflare).

**4. Long-term Preferences**
*   **Visual Documentation:** User prefers visual representations (images) over text-based markdown files for comparative analyses.
*   **Task Management:** User expects atomic, agent-based delegation where tasks are handled autonomously in the background and presented with clear status updates.
*   **Data Integrity:** User requires immediate cleanup of redundant or unwanted files (e.g., requested deletion of `analysis_nytvft.md` after an image was generated).

## Session Extract: 2026-05-06T02:41:17.156Z
### Long-term Memory: Project Summary

**1. Key Facts/Decisions Made**
*   **Identified Top 5 Global Media Outlets:** The New York Times, The Wall Street Journal, The Guardian, Financial Times, and Le Monde.
*   **Clarified Media Metrics:** Established a distinction between "journalistic influence" (the chosen list) and "circulation volume" (e.g., Yomiuri Shimbun, Dainik Bhaskar).
*   **Acknowledged Tool Limitations:** Mutually agreed that standard AI image generation models currently struggle with high-end typography, complex data layout, and text rendering, often resulting in poor-quality "ugly" visual output.
*   **Decision on Methodology:** Shifted strategy from "AI-painting" to "Data-driven generation" (using code) or "External prompting" to achieve professional-grade results.

**2. New Skills or Tools Added**
*   **Strategic Visualization:** Adopted the practice of using Python-based rendering (`matplotlib`/`seaborn`) as a superior alternative to native AI image generators for data-heavy infographics.
*   **Platform Awareness:** Clarified that internal chat environments often use standardized models and cannot dynamically "switch" to experimental backend codenames like "Nano Banana Pro" (Gemini 3 Pro Image) on demand.

**3. Project-Specific Context**
*   **Current Task:** Creating a comparative analysis infographic of the editorial focus, tone, and distinguishing characteristics of the world's top five newspapers for May 6, 2026.
*   **Standard of Quality:** The user prioritizes clean, professional, and crisp visual communication over artistic or "AI-generated" aesthetics.

**4. Long-term Preferences**
*   **Preference for Utility over Artistry:** For data representation tasks, the user prefers high-precision, code-rendered charts or structural templates over generic, text-heavy AI image generations.
*   **Transparency:** The user values honest assessments of model limitations and expects clear, actionable paths to professional results rather than persistent attempts with substandard tools.

## Session Extract: 2026-05-07T02:44:12.414Z
### Long-term Memory Summary: Francesco

**1. Key Facts/Decisions Made**
*   **Timezone:** User is operating in Eastern Daylight Time (EDT, UTC-4).
*   **Status:** Confirmed active work on the **Rally NYC** project.
*   **Technical Blocker:** Supabase database connection is currently failing due to a URL configuration issue.

**2. New Skills or Tools Added**
*   *None identified in this session.*

**3. Project-Specific Context**
*   **Tra-Montiemare:** A project based in Scalea (noted as an active area of interest/responsibility).
*   **Rally NYC:** Current primary focus; requires immediate attention to database connectivity (Supabase) to proceed with user-related queries.

**4. Long-term Preferences**
*   **Personalization:** User identifies as "Francesco."
*   **Communication Style:** Direct, task-oriented; prefers proactive troubleshooting when technical blockers are identified.

## Session Extract: 2026-05-07T03:02:19.645Z
### Long-term Memory: Project & Context Summary

**1. Key Facts/Decisions**
*   **Status of Blog Post:** The article "Why the New York Times Named Calabria a Must-Visit Destination" (ID: `9e88af2d-3176-4cfe-a6b8-cd16cea5f1aa`) has been successfully updated to `status: published` in the Supabase database.
*   **Caching Issue:** Confirmed that the frontend is displaying stale data (`draft`) despite the database reflecting the correct `published` status, indicating a persistent caching layer in the website's infrastructure.
*   **Operational Stance:** Acknowledged a failure to diagnose the frontend caching behavior effectively, leading to user frustration.

**2. New Skills or Tools Added**
*   **Supabase Schema Audit:** Deep familiarity with the `blog_posts` table structure (including SEO fields, JSON-LD, and canonical URLs).
*   **Direct API/Tool Integration:** Attempted usage of `supabase_action` and `curl` for database updates; learned the necessity of identifying frontend hosting providers (Vercel/Netlify/Cloudflare) to handle cache invalidation programmatically.

**3. Project-Specific Context**
*   **Tra-Montiemare:** A property management/lifestyle brand based in Scalea, Italy.
*   **Content Strategy:** Uses a Supabase-backed CMS. The workflow involves drafting in the database, automated editorial review, and manual or automated publishing.
*   **Existing Assets:** The project already includes an "Arrival Guide for Guests" (critical context missed by the model during the interaction).
*   **Brand Voice:** "Slow living," informative, welcoming, and tied to Southern Italian culture.

**4. Long-term Preferences**
*   **Orchestration Style:** The user values direct, high-agency problem solving. When technical issues arise (like publishing status), the user prefers the model to exhaust technical solutions (e.g., service keys) rather than defaulting to "it's a cache issue" before verifying the infrastructure stack.
*   **Correction:** The model needs to demonstrate greater awareness of existing project assets (like the "Arrival Guide") to avoid repeating redundant tasks or making inaccurate assumptions about the state of the content.

## Session Extract: 2026-05-09T14:41:05.588Z
### Long-term Memory: Property & Guest Management

#### 1. Key Facts/Decisions Made
*   **Property Status:** "Floor 1" (Piano 1) has a vacancy from June 1–9, 2026, due to a cancellation.
*   **Current Guest:** Paula Albertella’s current stay ends May 31, 2026.
*   **Decision:** Offered Paula a discounted rate of **€500** for a 7-night extension (June 1–8). 
*   **Financial Rationale:** Accepted that an 80% vacancy risk makes the €500 offer a sound financial move to ensure occupancy and guest loyalty.
*   **Communication Strategy:** Positioned the discount as a "one-time special gesture" to protect the standard €750 rate from future "anchoring" expectations.

#### 2. New Skills or Tools Added
*   **Drafting Strategies:** Implemented a dual-language (English/Italian) communication template for guest extensions.
*   **Pricing Analysis:** Utilized a "pro vs. con" framework to evaluate the financial viability of aggressive last-minute discounts.

#### 3. Project-Specific Context
*   **Unit Name:** Floor 1 (Piano 1 con terrazza privata).
*   **Pricing Baseline:** Standard weekly rate for June is €750.
*   **Management Team:** Francesco & Enerlida.
*   **Guest Lifecycle:** Proactive management of existing guests to fill unexpected calendar gaps.

#### 4. Long-term Preferences
*   **Occupancy Strategy:** Preference for high occupancy over full-price margins when vacancy probability is high (>80%).
*   **Relationship Management:** Focus on guest goodwill and loyalty to encourage 5-star reviews and repeat bookings.
*   **Pricing Integrity:** Careful to label significant discounts as "one-time" or "last-minute" to avoid devaluing the property for future bookings.

## Session Extract: 2026-05-09T14:44:05.705Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Decision:** Agreed to avoid direct, forced interaction with websites protected by advanced Cloudflare challenges (e.g., Financial Times) to prevent IP blacklisting and session failure.
*   **Fact:** Direct scraping of high-security sites is an adversarial "cat-and-mouse" game; current automated browser environments are consistently flagged by server-side behavioral analysis.

**2. New Skills or Tools Added**
*   **Operational Awareness:** Acknowledged specific technical limitations regarding browser fingerprinting, residential proxy requirements, and behavioral mimicry.
*   **Strategy:** Shifted to high-reliability information retrieval methods (e.g., Google News/aggregated sources) as a preferred alternative to direct site scraping.

**3. Project-Specific Context**
*   **Goal:** Accessing premium news content (Financial Times) via autonomous agents.
*   **Constraint:** The agent identified that despite having 24 capabilities, it lacks the specific infrastructure (e.g., residential proxies, dynamic browser fingerprinting) to bypass sophisticated anti-bot protections reliably.

**4. Long-term Preferences**
*   **Efficiency:** The user prefers "high-agency" problem solving but values reliability over persistent, low-success-rate technical workarounds.
*   **Workflow:** When direct access fails, the user prefers the agent to pivot to the next most reliable source rather than continuing to exhaust limited resources on an blocked endpoint.

## Session Extract: 2026-05-09T17:20:41.938Z
# Long-term Memory: Browser Architecture & Project Context

## 1. Key Facts/Decisions
*   **Project Goal:** Migrating the agent’s browser interaction from isolated CLI-based spawning to a persistent, long-running daemon.
*   **Methodology:** Adopted "OpenClaw" inspiration—connecting to a local Chrome instance via `--remote-debugging-port=9222` to inherit user authentication (cookies, history, sessions).
*   **Infrastructure:** Decoupled browser lifecycle management into a new `BrowserManager` utility.
*   **Constraint:** The system cannot bypass server-side behavioral analysis if it detects an automated agent, even with valid login profiles.
*   **Client Communication:** Drafted a professional WhatsApp reply for "TraMonti e Mare" regarding direct booking (150€ discount, 50% deposit, specific cancellation policy: 100% refund >30 days, 50% refund 14-30 days, 0% <14 days).

## 2. New Skills or Tools Added
*   **`BrowserManager` (Class/Module):** Manages the Chrome daemon, profile path resolution, and persistent connection.
*   **Refactored `browser_control.js`:** Now delegates lifecycle commands (init, execute) to the `BrowserManager`.
*   **Environment Configuration:** Added support for headless-mode flagging and automation control (e.g., `--disable-blink-features=AutomationControlled`).

## 3. Project-Specific Context
*   **Host Environment:** macOS (Chrome user data located at `~/Library/Application Support/Google/Chrome/Default`).
*   **Current Workflow:** User must close existing Chrome windows before the agent can successfully `init` the persistent browser daemon.
*   **Persistence Strategy:** Moving away from ephemeral `data/` directories to direct mapping of the local user profile.

## 4. Long-Term Preferences
*   **Security/Privacy:** Prefer agent-browser architectures that do not hijack active personal windows but rather mirror the user's logged-in state through managed persistence.
*   **Interaction Style:** Expects "Human-like" simulation (delays, mouse jitter, non-instantaneous typing) to avoid triggering bot detection systems on sites like Reddit and Financial Times.
*   **Transparency:** Prioritizes professional, well-documented communication for rental/business inquiries.

## Session Extract: 2026-05-11T02:17:51.850Z
### Long-term Memory: Project Tra-Montiemare

**1. Key Facts/Decisions Made**
*   **Guest Communication:** Successfully drafted a personalized outreach message to current "Piano 1" guest (Paula Albertella) offering a booking extension through June 8th.
*   **Automation Strategy:** Evaluated two distinct methods for WhatsApp integration. Decided against browser-based UI automation for WhatsApp due to instability and high risk of account flagging.

**2. New Skills or Tools Added**
*   **Baileys Library:** Identified as the technical tool behind "OpenClaw" to emulate the WhatsApp Web protocol for direct server-side communication.
*   **Protocol Emulation vs. Browser Automation:** Gained understanding that direct WebSocket protocol communication (Baileys) is more efficient and reliable than full browser simulation (CDP) for messaging tasks.

**3. Project-Specific Context**
*   **Property:** "Piano 1" apartment in Scalea.
*   **Guest Data:** Paula Albertella (Current guest, May 3–31).
*   **Operational Workflow:** Manual check of availability followed by AI-assisted drafting of guest outreach.

**4. Long-term Preferences**
*   **Business Stability:** Priority is placed on account safety. The user was advised that the **WhatsApp Business API** is the recommended, professional path for business operations to avoid bans.
*   **Acceptance of Risk:** Acknowledged that while "Baileys" is technically viable for a "high-agency" personal setup, it carries the risk of service disruptions due to unofficial status and potential Meta security updates.

## Session Extract: 2026-05-11T03:23:24.952Z
### Long-term Memory: Rally-NYC Marketing & Growth

#### 1. Key Facts & Decisions
*   **Campaign Theme:** "Sweeping the Court." Leveraged the cultural momentum of the New York Knicks sweeping the Philadelphia 76ers to create a high-engagement hook for tennis players.
*   **Core Value Proposition:** Positioned the app as a tool to end "guessing games" at local courts; users are encouraged to be "Community MVPs" by posting court status/availability.
*   **Growth Strategy:** Implementing a "Bounty" program targeting the first 50 signups who contribute three court updates to earn "Featured Partner" status.
*   **Target Communities:** 
    *   NYC Tennis Players (Facebook)
    *   r/NYCtennis (Reddit)
    *   Astoria Park Tennis (Facebook)

#### 2. New Skills & Tools
*   **Hyper-Personalized Copywriting:** Integrated real-time local context (weather shifts and NYC cultural events like the Jack Kirby way ceremony) to increase email open rates and relevance.
*   **Community Seeding:** Developed a structured outreach template for local sports groups to incentivize early-stage user engagement.

#### 3. Project-Specific Context
*   **Branding Style:** High-contrast, tech-forward aesthetic. Key colors: Electric Blue, Bright Tennis-Ball Yellow, White.
*   **Design Preference:** Transitioning toward minimalist, geometric, and architectural vector designs for app assets.
*   **Constraint Notice:** The project is currently experiencing significant rate-limiting issues with automated image generation tools. Future visual requests should be spaced out by at least 60–120 minutes to prevent API lockout.

#### 4. Long-term Preferences
*   **Tone:** High-energy, punchy, and culturally relevant (NYC-sports centric).
*   **Content Focus:** Problem/Solution-oriented (e.g., addressing the pain of wasted trips to full courts).
*   **Visual Direction:** Avoid "silly" or distorted AI imagery. Preference for sharp, precise, minimalist graphic design that aligns with a clean, modern app identity.

## Session Extract: 2026-05-11T03:35:57.391Z
### Long-Term Memory Summary

#### 1. Key Facts/Decisions Made
*   **Project Status:** Confirmed the `send-marketing-campaign` is a **Supabase Edge Function** (not a database RPC).
*   **Integration:** Successfully configured `RESEND_API_KEY_RALLY` in the project `.env` file to allow programmatic access to email delivery logs.
*   **Automation:** Scheduled a permanent background job to check the status of marketing campaigns via the Resend API.
*   **Scheduling Update:** The automated status report is locked for **08:05 CEST** daily.
*   **Reporting:** All campaign status updates will be delivered directly to the user via **Telegram**.

#### 2. New Skills or Tools Added
*   **Resend API Integration:** Enabled the Developer agent to query `v1/emails` endpoints for delivery tracking and status reporting.
*   **Persistence Proof:** Confirmed that scheduled tasks and environment variables are stored in the project's persistent file system (`.env` and system task queue), ensuring continuity across different chat sessions.

#### 3. Project-Specific Context
*   **Rally NYC:** 
    *   Current marketing hook: *"Knicks swept the Sixers. Now, can you sweep the court?"* 
    *   Infrastructure: The project uses Supabase Edge Functions for business logic and Resend for mail delivery. 
    *   Identified that individual early-subscriber emails are tracked in the `profiles` table (`early_subscriber_email_sent_at`), but bulk marketing is handled via the separate `send-marketing-campaign` Edge Function.
*   **Tra-Montiemare:** Remains an active project in the Orchestrator's dashboard for guest inquiry management and database housekeeping.

#### 4. Long-Term Preferences
*   **Task Resilience:** The user prioritizes robust, automated backend verification over manual status checks.
*   **Notification Protocol:** Preferred communication channel for automated reports is **Telegram**.
*   **Error Mitigation:** Explicitly requested a 5-minute buffer (08:05 vs 08:00) for morning reports to ensure data processing is complete before notification.
*   **Communication Style:** The Orchestrator should provide technical transparency regarding *how* tasks are persisted (e.g., distinguishing between session history and background cron jobs).

## Session Extract: 2026-05-14T03:09:40.339Z
### Long-term Memory: RallyNYC

#### 1. Key Facts/Decisions
*   **Marketing Campaign:** A broadcast email was drafted to inform users of recent mobile messaging fixes for the RallyNYC app.
*   **Narrative Style:** Adopted a personal, "hobbyist" tone emphasizing that the project is run by a tennis addict, using self-deprecating humor and a sarcastic CTA to encourage user engagement.
*   **Performance Bottleneck Identified:** The current `send-marketing-campaign` Edge Function is too slow due to sequential, synchronous API calls inside a `for` loop, causing high latency and potential future timeouts.

#### 2. New Skills or Tools Added
*   **Architectural Pattern:** Transition from synchronous, sequential execution to an asynchronous, queue-based system for background tasks.
*   **Optimization Strategy:** Moving away from per-user API calls by caching user email addresses in the `profiles` table upon registration to eliminate redundant Auth Admin API lookups.

#### 3. Project-Specific Context
*   **Application:** RallyNYC (a court and partner finder for NYC tennis players).
*   **Infrastructure:** Uses Supabase Edge Functions, Deno, and the Resend API.
*   **Asset Management:** Marketing banner hosted via Supabase Storage: `https://oylhowvuhatfiyejjhwd.supabase.co/storage/v1/object/public/mktg/messages-bug.jpeg`.

#### 4. Long-term Preferences
*   **Communication Style:** Casual, authentic, and community-focused; the user prefers the "solo founder/tennis enthusiast" brand voice over corporate marketing speak.
*   **Technical Philosophy:** Prefers scalable, robust solutions; willing to refactor existing code (e.g., implementing a queue system) to prevent performance degradation as the user base grows.

## Session Extract: 2026-05-29T00:53:34.737Z
### Long-term Memory Summary

**1. Key Facts/Decisions Made**
*   **Booking Correction:** Confirmed the *Attico (Top Floor)* is fully booked from September 12 to October 31, 2026 (Guest: Inguna).
*   **Calendar Correction:** Confirmed that *Piano 1* is fully available from October 22, 2026, through the end of the year (previous database entries for Nathalie Callens were identified as 2025 records, not 2026).
*   **Pricing Strategy:** Implemented a blended pricing model for shoulder-season crossovers (e.g., August 31–September 12), utilizing high-season nightly rates for August and weekly discounted rates for the September portion.

**2. New Skills or Tools Added**
*   **Database Audit Protocol:** Established a requirement to cross-reference `guests` table data with the `year` and `status` fields before quoting availability to avoid legacy data errors.

**3. Project-Specific Context**
*   **Apartment Inventory:**
    *   *Attico (Top Floor):* Primary, high-view unit.
    *   *Piano 1 (First Floor):* Secondary unit, high occupancy in peak summer.
*   **Pricing Constants:** 
    *   *Attico High-Season (July):* €145/night base.
    *   *Attico High-Season (August):* €165/night base.
    *   *Attico September Weekly Rate:* €950.
    *   *Cleaning Fee:* Standardized at €50.

**4. Long-term Preferences**
*   **Communication Tone:** Warm, inviting, and personalized (e.g., "Ciao," "slow living," "secret spots").
*   **Guest Interaction:** Proactively offer local recommendations (food/wine) to enhance the guest experience after finalizing bookings.
*   **Operational Integrity:** When in doubt about database accuracy, manually verify records rather than relying on automated queries if contradictions (like the 2025/2026 year error) arise.

## Session Extract: 2026-05-30T01:05:02.197Z
### Long-term Memory: Tra-Montiemare

**1. Key Facts/Decisions Made**
*   **WhatsApp Integration:** All booking inquiry responses must now include a standard closing invitation to contact the hosts via WhatsApp at [http://wa.me/16468985960](http://wa.me/16468985960).
*   **Operational Workflow:** When a turnover day is required (e.g., preparing for new arrivals), it is standard practice to propose a slightly shorter stay to guests if the requested checkout date conflicts with the cleaning/preparation schedule.
*   **Marketing Automation:** Confirmed access to monitor email delivery status via the Resend API.

**2. New Skills or Tools Added**
*   **Resend API:** Integrated for checking the delivery status of marketing campaigns and transactional emails.
*   **Telegram Notification:** Enabled for status updates regarding automated background jobs (e.g., campaign success/failure reports).
*   **Database Querying:** Proficiency in checking availability across integrated platforms (Hostex/Supabase).

**3. Project-Specific Context**
*   **Property Details:**
    *   *Top Floor (Attico):* Marketed for romantic/peaceful stays.
    *   *Floor 1 (Piano 1):* Marketed for families; features a private terrace.
*   **Operations:** The team requires a minimum of one full day between bookings for cleaning and apartment preparation.
*   **Location:** The property is located in Scalea; hosts emphasize providing guests with "local secret spots" (hidden beaches/authentic restaurants) as part of the guest experience.

**4. Long-term Preferences**
*   **Communication Style:** Warm, professional, and inviting. The host persona is "Francesco & Enerlida."
*   **Proactive Guest Support:** Always confirm availability, suggest specific property features based on the guest's stated intent (e.g., romantic vs. family), and offer clear pathways for rapid communication (WhatsApp).

## Session Extract: 2026-06-07T14:04:37.147Z
### Long-term Memory Update

**1. Key Facts/Decisions Made**
*   **Protocol Update:** All guest communications must use the greeting format: "Ciao [Name] 🌊".
*   **Team Voice:** All communications should be written in the first-person plural ("We") to reflect that the property is managed by both Francesco and Enerlida.
*   **Tone/Style:** Responses should be empathetic and human. Avoid "AI-sounding" filler. When replying to complaints, remain empathetic but non-defensive, providing context where necessary without making excuses.
*   **Communication Channels:** Always reply in the same language as the guest's inquiry. When replying to WhatsApp messages, avoid proposing a switch to WhatsApp (since the conversation is already there) and maintain a casual, message-appropriate length rather than an email-style format.
*   **Insurance/Admin:** When filling insurance forms, use the Account Name (e.g., "UNOPS IICA") for the Group Number, not the network name (e.g., "MultiPlan").

**2. New Skills/Tools Added**
*   **Database Management:** Ability to query Supabase tables to check real-time property availability for "Tra-Montiemare" (avoiding assumptions).
*   **Scheduled Jobs:** Capability to interface with Resend API for marketing campaigns and provide status updates via Telegram.

**3. Project-Specific Context**
*   **Tra-Montiemare:** A vacation rental property in Scalea. 
    *   **Piano 1 (First Floor):** ID `984ef1c8-78d4-4b7f-8eb8-27f2b058be27`.
    *   **Availability:** Availability must be checked via Supabase for specific date ranges before confirming to guests.
    *   **Marketing Asset:** A sunset video is available for sharing with interested guests: [https://www.youtube.com/shorts/mQ8imLuc5bM](https://www.youtube.com/shorts/mQ8imLuc5bM).
*   **Rally NYC:** A tennis-focused community platform currently prioritizing "The Post-Sweep Rush" marketing campaign (leveraging local sports momentum to drive platform usage/data collection).

**4. Long-term Preferences**
*   **Tone:** Friendly, professional, but concise (especially for WhatsApp).
*   **Customer Service:** When guests complain about noise/environment, validate their experience, mention the uniqueness of the situation, and offer support/flexibility without taking blame for external factors.

## Session Extract: 2026-06-13T14:47:44.644Z
### Long-term Memory: TraMonti e Mare

**1. Key Facts/Decisions**
*   **Booking Conflict:** A booking (Angela Zurschmiede, July 2026) was cancelled due to unavoidable structural work required at the property. 
*   **Platform Stance:** The hosts have taken a firm stance against Booking.com’s policy of holding hosts financially liable for relocation costs caused by essential, unavoidable maintenance. The hosts are prepared to close their Booking.com account if forced to pay these costs.
*   **Operational Note:** Hosts cannot directly cancel reservations on Booking.com; this action must be initiated by the guest or the platform.
*   **Pricing/Inquiry:** The rate for the "Top Floor – Breathtaking Views" apartment for a month-long stay in May 2027 is **€1,300** (plus a **€50** final cleaning fee).

**2. New Skills/Tools**
*   **Calendar/Guest Data Integration:** The system is now expected to cross-reference internal reservation calendars and guest databases to provide specific availability and occupancy reports.
*   **Communication Channel:** WhatsApp contact link established for direct guest inquiries: [http://wa.me/16468985960](http://wa.me/16468985960).

**3. Project-Specific Context**
*   **Property Identity:** "TraMonti e Mare" located in Scalea, Italy.
*   **Key Amenities/Marketing:** Highlighting the location as an authentic "slow living" destination with local food and hospitality. 
*   **Media Assets:** Sunset video link for marketing purposes: [https://www.youtube.com/shorts/mQ8imLuc5bM](https://www.youtube.com/shorts/mQ8imLuc5bM).

**4. Long-term Preferences**
*   **Host Communication Style:** Professional yet warm (using the 🌊 emoji). Direct and protective of business interests regarding platform fees and maintenance obligations.
*   **Operational Priority:** Maintaining the structural integrity of the property is a non-negotiable priority, regardless of booking schedules.
*   **Guest Engagement:** Hosts prefer to provide personalized local recommendations ("secret spots," trattorias) to enhance the guest experience.

## Session Extract: 2026-06-21T18:32:36.475Z
### Long-Term Memory Update

#### 1. Key Facts/Decisions Made
*   **Booking confirmed:** Aniello Panariello, Aug 17–23, 2026. 5 guests.
*   **Property:** Scalea apartment (Note: potential capacity check required for "Piano 1" vs. "Attico").
*   **Communication Style:** Warm, professional, using "we" (Francesco and Enerlida), friendly/inviting tone.

#### 2. New Skills/Tools Added
*   **Dynamic Guide Link Generation:** Adopted a standardized URL structure for guest guides: `https://www.tra-montiemare.it/guest?code={access_code}`.

#### 3. Project-Specific Context
*   **Brand:** "Tra Monti e Mare" (Scalea property).
*   **Communication Workflow:** Greeting messages must include guest names, stay dates, and the personalized dynamic guide link.
*   **Host Data Sources:** Information is retrieved via Hostex or Supabase integrations.

#### 4. Long-Term Preferences
*   **Messaging Protocol:** Always include the dynamic guide link in initial welcome messages.
*   **Tone:** Maintain a warm, welcoming, and hospitable Italian tone for all guest interactions.