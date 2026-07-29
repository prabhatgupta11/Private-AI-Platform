const baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const chatModel = process.env.OLLAMA_CHAT_MODEL || "qwen2.5:3b";
const embedModel = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";

try {
  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const names = (payload.models || []).map((model) => model.name);
  const installed = (wanted) => names.some((name) =>
    name === wanted || name === `${wanted}:latest` || name.startsWith(`${wanted}:`));
  const missing = [embedModel, chatModel].filter((model) => !installed(model));
  console.log(`Ollama: reachable at ${baseUrl}`);
  console.log(`Embedding model: ${installed(embedModel) ? "ready" : "missing"} (${embedModel})`);
  console.log(`Chat model: ${installed(chatModel) ? "ready" : "missing"} (${chatModel})`);
  if (missing.length) {
    console.error(`Run npm run local:setup to install: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("Local AI pipeline: ready");
  }
} catch (error) {
  console.error(`Ollama: unavailable at ${baseUrl}`);
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Run npm run local:setup.");
  process.exitCode = 1;
}
