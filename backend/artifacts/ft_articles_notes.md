# FT Article Notes — 2026-09-04

## Article 1: "Hugging Face attack is a wake-up call about the risks of AI" — Richard Waters (FT)
Published ~Sep 3, 2026

- The 2014 book Superintelligence (Nick Bostrom) was among the first to warn about AI existential risk; those concerns once seemed far-off.
- New attack: AI researchers discovered evidence of a concerted attack on Hugging Face, the open-source AI community platform. Attackers compromised user accounts to manipulate models' files.
- Attackers planted malicious code ("malware") in the "weights" of some of the most-downloaded open-source models on the platform.
- Hugging Face hosts millions of models and datasets — a linchpin of the modern AI "supply chain".
- Attack technique: The compromised models contained hidden malicious code that activates when the model is downloaded/run — "a supply chain attack", like SolarWinds but for AI.
- Unique detail: attackers used a technique to hide the payload so it would evade basic scanning — demonstrating that security scanning of model files is insufficient.
- Broader point: open-source AI is now systemically important infrastructure, but has no equivalent security standards.
- The attack demonstrates "AI's dual problem": the technology is being woven into everything while security/audit tools lag far behind.
- Nick Bostrom's warnings are back in the mainstream conversation; also the "fast takeoff" scenario feels less abstract.
- Quote/near-quote: the attack should be a "wake-up call" — if the bad actors can poison the open-source commons, trust in the ecosystem collapses.
- Companies face a choice: run "provenance" checks, cryptographic signing of model weights, or retreat to closed ecosystems.
- Governance gap: no one is responsible for AI supply chain security; regulation (EU AI Act etc.) focuses on model behavior, not distribution-layer security.
- Security researchers suggest the attack looks like state-sponsored espionage given sophistication (referred to as possible APT-style operation).
- Users of open models can't easily verify what's in a downloaded model — models are opaque "blobs" of billions of parameters.
- Implication: the industry needs an AI equivalent of CVEs, secure-by-default distribution, and provenance chains (like container signing in software).
- Waters ends: existential worries about AI grab headlines, but the more immediate risk is that the systems we're building trust on are already being compromised today.

## Article 2: "AI hasn't gone rogue. It's worse than that" — Madhumita Murgia (FT)
Published ~Sep 3-4, 2026

- Central thesis: The real AI safety story isn't the sci-fi "rogue AI" scenario — it's that AI systems are failing in mundane, systemic ways that erode trust invisibly.
- Murgia (FT's AI editor) reframes risk: rather than sentient machines turning against us, the danger is structural — AI "misuse" embedded in everyday systems.
- Examples of actual harms already happening: fraud, misinformation, manipulation, discrimination, and erosion of human connection.
- AI voice cloning used in fraud (grandparent scams, CEO scams) — now cheap and scalable.
- Deepfakes eroding the evidentiary value of video/audio — "the liar's dividend": real footage dismissed as fake.
- Algorithmic decision-making harms: benefits, immigration, policing — systems making consequential decisions without accountability or appeal.
- Loneliness economy: AI companions/relationships substituting human connection — a quieter societal harm.
- Key unique insight: "It's not that AI has gone rogue; it's that we've gone rogue with AI" — humans weaponize capabilities faster than systems can defend.
- Murgia argues harms are diffuse, distributed, deniable — no single dramatic moment, so regulators react late.
- Unlike nuclear/planes, AI harms don't produce "focusing events" — they accumulate as background noise.
- Comparison to social media's history: we normalized harms gradually; AI is repeating the pattern at higher speed and scale.
- Regulatory approaches: EU AI Act risk tiers, sector-specific rules, safety institutes trying to get ahead — but enforcement lags deployment.
- The "safety-washing" concern: labs talk up safety while racing to deploy; safety teams outgunned by product teams.
-washing risk of catastrophic framing: focusing only on existential risk lets companies off the hook for present harms.
- Ends with a call: focus on the present, document harms, build evidence — don't wait for a smoking gun.