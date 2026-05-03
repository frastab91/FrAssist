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