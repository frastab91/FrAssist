# Task for tech_essayist_copy_editor
Write the complete long-form draft of the interactive essay for the site `open-ai-supply-chain` (project dir: ~/Desktop/Progetti/open-ai-supply-chain). Thesis: **the open-weight AI ecosystem has quietly become a software supply chain, and the Hugging Face breach of July 2025 is the moment it stopped being theoretical.**

VERIFIED RESEARCH FACTS (use exactly; do not invent beyond these):

TIMELINE
- June 30, 2025 — Phase 1: Known AI jailbreaker "Pliny the Liberator" discovers abandoned Hugging Face organizations can be taken over by simply requesting access (no admin gate). Announces "Hugging Face Hacked" on X; posts a YouTube manifesto explaining "the exploit."
- July 1–2, 2025 — Phase 2: Compromise of active accounts, targeting members of AI/military/VC organizations. Victims had installed a phishing-delivered fake browser extension.
- July 2–3, 2025 — Phase 3: Hijacking of org accounts via Discord phishing. Attacker obtained leaked HF access tokens embedded in maliciously modified pickle files; 100+ accounts compromised. Mass defacement: orgs renamed "hugging-a-face"; defaced repos incl. "wokewashing"; screenshots posted showing org token access; some repos poisoned with crypto-miners (XMRig) and infostealers.
- July 3, 2025 — Hugging Face security advisory: "We are aware of and investigating a recurring issue involving some Hugging Face organizations."
- July 4–6, 2025 — Checkmarx publishes "Hugging Face Hacked: Attackers Use Hugging Face Token Theft to Compromise 100+ Accounts." HF pushes fixes, invalidates suspect tokens, instructs org admins to re-auth and rotate secrets.

ATTACK VECTOR (three legs)
1. Governance hole: abandoned orgs claimable via "request access" — no admin intervention.
2. Phishing: Discord DMs impersonating HF staff → fake domain "huggingface-cdn[.]com" → fake browser extension (FakeDrainer tooling) harvesting browser passwords/cookies.
3. Token theft: harvested HF org tokens (write-scoped API tokens) reused directly; tokens also exfiltrated by maliciously modified pickle files — model weights used as code-execution vehicles.

SCOPE
- Attackers claimed access to ~100,000 repos; Hugging Face disputed the figure. Demonstrated/verified scope: 100+ accounts hijacked, hundreds of repos defaced, malicious pickle payloads, exposed org tokens visible in defaced repos.

MOTIVE
- Hybrid: hacktivist/prank defacement (Pliny's manifesto, anti-"AI bro" vitriol, vulgar renames) + opportunistic monetization (FakeDrainer credential harvesting, XMRig crypto-miners, infostealers). Researcher consensus: "disruptive hacktivism with opportunistic monetization."

THE IGNORED WARNINGS (pre-incident)
- Pickle serialization = arbitrary code execution by design; ReversingLabs warned in 2023 that ML model files were a new attack vector; HF itself pushed safetensors as the safe default, years before this breach.
- Org token hygiene: long-lived, org-wide, write-scoped tokens widely embedded in notebooks/CI.
- Abandoned org ownership: a known dangling-permission class.

PARALLELS
- SolarWinds (2020), xz-utils backdoor (March 2024): trusted intermediary compromised, trust inherited downstream. What's new in AI: models ARE executables; weight files ARE code; plus monoculture — millions of models on a single hub consumed by enterprises and governments.

WHAT MUST CHANGE (forward section)
- safetensors-by-default; pickle treated as unsigned executable code.
- Org governance: token rotation, scoped tokens, orphan-org reclamation policies.
- Provenance & signing: Sigstore-style model signing, model SBOM / AIBOM.
- Policy: treat model hubs as critical infrastructure — international coordination on AI supply-chain security. (Author works at the UN on digital & emerging tech cooperation; keep this closing note pragmatic, not preachy, no UN jargon.)

STYLE & STRUCTURE
- Register: Economist-grade tech essay — declarative, precise, dry wit allowed. Zero fluff, zero clichés ("game-changer", "in today's fast-paced world" banned).
- Audience: tech-literate general readers + policy people. Personal-byline essay, not an institutional statement.
- Length: 2,400–3,000 words.
- Cold open: the July 2 defacement scene ("hugging-a-face"), then pivot: "It looks like a prank. It isn't."
- Structure: cold open → anatomy (three phases, vector, payloads) → the scope dispute and what it reveals → the ignored warnings → parallels (SolarWinds, xz: what's same, what's worse) → what must change → close: the open-AI dream runs on the same brittle plumbing as everything else; model hubs are critical infrastructure whether or not we admit it.
- Markdown section heads with clean kebab-case slugs for the site TOC; one pull-quote candidate (≤30 words) per major section; a compact timeline box (list format).
- Citations: inline as "(Outlet, Date)" — e.g. "(Ars Technica, July 3, 2025)" — do NOT invent URLs; final source URLs will be attached separately.
- Sources available for citation: Hugging Face Security Advisory (July 3, 2025); Checkmarx blog "Hugging Face Hacked..."; Ars Technica (July 3, 2025); BleepingComputer (July 2, 2025); The Register (July 3, 2025); ReversingLabs (2023) pickle warnings; Pliny the Liberator's X/YouTube manifesto (June 30–July 1, 2025).

DELIVERABLE FORMAT
1. Kicker deck: H1 title + subtitle (≤20 words) + 3 pull-quote candidates + section slug TOC.
2. The full essay in markdown.
Return ONLY the markdown draft.