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