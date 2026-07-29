#!/usr/bin/env bash
set -euo pipefail

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is required. Install it from https://ollama.com/download and run this command again."
  exit 1
fi

mkdir -p .wrangler
if ! curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Starting the local Ollama service..."
  nohup ollama serve >.wrangler/ollama.log 2>&1 &
  for _attempt in $(seq 1 30); do
    if curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl --silent --fail --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "Ollama did not start. Check .wrangler/ollama.log."
  exit 1
fi

chat_model="${OLLAMA_CHAT_MODEL:-qwen2.5:3b}"
embed_model="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"

echo "Installing the local embedding model: ${embed_model}"
ollama pull "${embed_model}"
echo "Installing the local language model: ${chat_model}"
ollama pull "${chat_model}"
echo "Local AI is ready. Run: npm run dev"
