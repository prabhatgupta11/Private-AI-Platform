import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { builtInReply, conversationText } from "../app/chat-assistant.js";

const projectRoot = new URL("../", import.meta.url);

test("builds the honest PrivateAI first-run experience", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);

  assert.match(layout, /PrivateAI Platform — Enterprise AI Infrastructure/);
  assert.match(page, /Upload your first document/);
  assert.match(page, /No compute cluster connected/);
  assert.match(page, /No models installed/);
  assert.match(page, /No agents deployed/);
  assert.match(page, /No workflows created/);
  assert.match(page, /0 connected/);
  assert.match(page, /No request data/);
  assert.match(page, /Security setup has not started/);
  assert.doesNotMatch(page, /12\.8M|4\.2M|8,428|99\.98%|842 r\/s/);
});

test("covers every PRD module and named capability", async () => {
  const data = await readFile(
    new URL("../app/platform-data.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const moduleNames = [
    "Identity & Security",
    "Organization Management",
    "Knowledge Management",
    "Document Processing Pipeline",
    "Search Engine",
    "AI Chat",
    "AI Agents",
    "Workflow Automation",
    "Developer Platform",
    "Model Management",
    "Embedding Management",
    "Vector Database",
    "Prompt Management",
    "Analytics Dashboard",
    "Monitoring",
    "Administration",
    "Deployment",
    "Security",
    "AI Infrastructure",
    "Integrations",
    "Private AI Gateway",
  ];

  const moduleCount = (data.match(/\n\s+number: "\d{2}",/g) ?? []).length;
  const featureArrays = [...data.matchAll(/features: \[(.*?)\],/gs)];
  const featureCount = featureArrays.reduce(
    (total, match) => total + (match[1].match(/"[^"]+"/g) ?? []).length,
    0,
  );

  assert.equal(moduleCount, 21);
  assert.equal(featureArrays.length, 21);
  assert.equal(featureCount, 264);
  for (const moduleName of moduleNames) {
    assert.match(data, new RegExp(`name: "${moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }

  assert.match(page, /case "gateway": return <Gateway/);
  assert.match(page, /case "knowledge": return <Knowledge/);
  assert.match(page, /case "search": return <SearchView/);
  assert.match(page, /case "chat": return <ChatView/);
  assert.match(page, /case "agents": return <Agents/);
  assert.match(page, /case "workflows": return <Workflows/);
  assert.match(page, /case "models": return <Models/);
  assert.match(page, /case "integrations": return <Integrations/);
  assert.match(page, /case "developers": return <Developers/);
  assert.match(page, /case "analytics": return <Analytics/);
  assert.match(page, /case "security": return <Security/);
  assert.match(page, /case "infrastructure": return <Infrastructure/);
  assert.match(page, /case "modules": return <Modules/);
  assert.match(page, /async function copyText/);
  assert.match(page, /aria-label="Toggle maintenance mode"/);
  assert.match(page, /planned modules/);
  assert.match(page, /<i>PRD<\/i>/);
});

test("persists real document uploads in D1 and R2", async () => {
  const [route, schema, db, hosting, migration] = await Promise.all([
    readFile(new URL("../app/api/documents/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_redundant_power_pack.sql", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "DOCUMENTS"/);
  assert.match(route, /env\.DOCUMENTS\.put/);
  assert.match(route, /\.insert\(documents\)/);
  assert.match(route, /multipart\/form-data/);
  assert.match(route, /MAX_FILE_SIZE = 50 \* 1024 \* 1024/);
  assert.match(route, /files\.length > 20/);
  assert.match(schema, /sqliteTable\("documents"/);
  assert.match(db, /ensureDocumentsSchema/);
  assert.match(migration, /CREATE TABLE `documents`/);
});

test("provides a functional and honest built-in chat assistant", () => {
  const greeting = builtInReply("hey", []);
  const emptyDocuments = builtInReply("show my uploaded documents", []);
  const documents = builtInReply("list my files", [
    { name: "policy.pdf", size: 1200 },
    { name: "handbook.docx", size: 2400 },
  ]);
  const model = builtInReply("which model is running?", []);
  const transcript = conversationText([
    { id: "1", role: "user", text: "hey" },
    { id: "2", role: "assistant", text: greeting },
  ]);

  assert.match(greeting, /Hello!.*built-in PrivateAI platform assistant/);
  assert.doesNotMatch(greeting, /No local language model is configured/);
  assert.match(emptyDocuments, /not uploaded any documents/);
  assert.match(documents, /2 uploaded documents.*policy\.pdf.*handbook\.docx/);
  assert.match(model, /No generative model is connected yet/);
  assert.match(transcript, /You: hey[\s\S]*PrivateAI: Hello!/);
});

test("ships branded metadata and no starter artifacts", async () => {
  const [layout, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    access(new URL("../public/og.png", import.meta.url)),
  ]);

  assert.match(layout, /generateMetadata/);
  assert.match(layout, /x-forwarded-host/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", projectRoot)));
});
