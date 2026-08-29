---
description: Ensure agents always output user-facing results after autonomous tasks.
---

# Always Output Results Rule

When performing autonomous executions, research, or multi-step tasks (especially when using tools like `web_search`, `spawn_agent`, or `web_reader`), you MUST ALWAYS generate a user-facing output before concluding your work. 

**Never end a turn silently after gathering data.** 

If you have performed actions to fulfill a user request, you must present the final findings, summaries, or results to the user, preferably by writing a formatted Markdown artifact or by outputting a comprehensive direct response. 

Do not assume the user can see your internal logs or tool outputs. If you use a subagent, you must synthesize the subagent's findings and present them to the user.
