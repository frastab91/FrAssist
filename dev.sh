#!/bin/bash

# Script to automatically run Backend and Frontend concurrently

# Ensure we are in the project root
cd "$(dirname "$0")"

echo "🚀 Starting FrAssist Development Environment..."

# Function to check if a directory exists
check_node_modules() {
  if [ ! -d "$1/node_modules" ]; then
    echo "📦 Installing dependencies in $1..."
    (cd "$1" && npm install)
  fi
}

# Check and install root dependencies (for concurrently)
check_node_modules "."

# Check and install backend dependencies
check_node_modules "backend"

# Check and install frontend dependencies
check_node_modules "frontend"

echo "✨ All dependencies checked. Launching services..."

# Run the dev script from root package.json
# This uses 'concurrently' to run both backend and frontend
npm run dev
