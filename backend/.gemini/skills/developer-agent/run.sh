#!/bin/bash
# Trigger the Gemini CLI for the developer agent
# Usage: ./run.sh "Task Description"

if [ -z "$1" ]; then
  echo "Usage: ./run.sh 'Task Description'"
  exit 1
fi

TASK=$1

echo "Developer Agent: Analyzing and executing task..."
# Executing with the developer-agent skill context
gemini -e developer-agent -p "$TASK"
