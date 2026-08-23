# DigitalOcean GenAI Inference Router Configuration

This document contains the configuration details, task definitions, and API integration code for the DigitalOcean Model Router (`router:frassistrouter`) in FrAssist.

---

## 1. Router General Settings

* **Router Name:** `frassistrouter` (target identifier: `router:frassistrouter`)
* **Endpoint URL:** `https://inference.do-ai.run/v1/chat/completions`
* **Description (Master Routing Prompt):**

```text
Evaluate each incoming request and route it to the lowest-cost model capable of completing the task accurately. Route routine tasks—such as simple conversations, greetings, FAQ lookups, WiFi/check-in info, and text classification—to lightweight, fast models. Route intermediate tasks—such as guest support responses, multilingual translations, summarization, and basic extraction—to mid-tier models. Reserve high-capacity advanced models strictly for complex reasoning, multi-step problem solving, structured JSON generation, tool calling, or handling escalation disputes.
```

---

## 2. Router Tasks Breakdown

### Task 1: `simple-faq-and-greetings` (Tier 1: Lowest Cost & Fast)
* **Target Model:** `Llama-3.2-1B-Instruct` or `Llama-3.2-3B-Instruct`
* **Task Description:**
```text
Handles simple pleasantries, greetings, acknowledgments, standard FAQs (WiFi network & password, check-in and check-out times, trash disposal, house rules), short text classification, intent detection, and quick single-turn chat responses.
```

---

### Task 2: `general-guest-assistant` (Tier 2: Balanced / Standard)
* **Target Model:** `Llama-3.1-8B-Instruct` or `Mistral-7B-Instruct-v0.3`
* **Task Description:**
```text
Handles conversational guest inquiries, multi-turn dialogue, multilingual guest support, local travel and restaurant recommendations, email draft generation, message tone polishing, and contextual knowledge base synthesis.
```

---

### Task 3: `complex-reasoning-and-tools` (Tier 3: High Capability)
* **Target Model:** `Llama-3.3-70B-Instruct` or `Mixtral-8x22B-Instruct`
* **Task Description:**
```text
Handles complex logic, multi-step agent planning, tool/function calling, strict schema-compliant JSON extraction, booking conflicts, escalation handling, financial calculation, and multi-document synthesis.
```

---

## 3. Environment Variables (`backend/.env`)

```ini
# DigitalOcean Serverless Inference
DIGITAL_OCEAN_API_KEY=your_digitalocean_model_access_key
DO_ROUTER_MODEL=router:frassistrouter
DO_INFERENCE_URL=https://inference.do-ai.run/v1/chat/completions
```

---

## 4. Usage in FrAssist Codebase

### Node.js (ES Module helper `backend/services/digitalocean.js`)

```javascript
import { createChatCompletion, streamChatCompletion } from './services/digitalocean.js';

// Standard call
const reply = await createChatCompletion([
  { role: 'user', content: 'What is the WiFi password for Flat 4B?' }
]);
console.log(reply);

// Streaming call
for await (const chunk of streamChatCompletion([
  { role: 'user', content: 'Tell me about the best seafood in Scalea.' }
])) {
  process.stdout.write(chunk);
}
```

### Python (using `requests`)

```python
import requests

url = "https://inference.do-ai.run/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_MODEL_ACCESS_KEY",
}
data = {
    "model": "router:frassistrouter",
    "messages": [
        {
            "role": "user",
            "content": "Are there any syntax issues here? Code: ...",
        }
    ],
    "stream": True,
}

response = requests.post(url, headers=headers, json=data, stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode("utf-8"))
```

### Running Test Verification

Run the test script from the backend directory:
```bash
node scripts/test_do_inference.js
```
