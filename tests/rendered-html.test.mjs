import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { builtInReply, conversationText, shouldUseBuiltInAssistant } from "../app/chat-assistant.js";
import { answerFromDocuments } from "../app/retrieval.js";
import { buildGroundedPrompt, chunkPages, cosineSimilarity, ensureCitations } from "../app/rag-core.js";

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
  assert.equal(shouldUseBuiltInAssistant("hey"), true);
  assert.equal(shouldUseBuiltInAssistant("what Kashika do?"), false);
});

test("answers open questions from extracted document passages with sources", () => {
  const answer = answerFromDocuments("what Kashika do?", [
    {
      name: "team-profile.pdf",
      text: "Our team combines strategy and delivery. Kashika leads customer research and turns the findings into product requirements. She also coordinates stakeholder reviews.",
    },
    {
      name: "pricing.txt",
      text: "Enterprise pricing is available on request.",
    },
  ]);
  const missing = answerFromDocuments("Where is the Tokyo office?", [
    { name: "team-profile.pdf", text: "The company has an office in Delhi." },
  ]);

  assert.match(answer.answer, /what the uploaded documents say about Kashika/i);
  assert.match(answer.answer, /Kashika leads customer research/);
  assert.deepEqual(answer.sources, ["team-profile.pdf"]);
  assert.match(missing.answer, /could not find content related/);
});

test("runs the complete local cited RAG pipeline", async () => {
  const [route, indexRoute, rag, page, packageJson, migration, readme] = await Promise.all([
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/index/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/local-rag.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_brown_avengers.sql", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(rag, /extractText, getDocumentProxy/);
  assert.match(rag, /privateai-extracted\.json/);
  assert.match(rag, /chunkPages/);
  assert.match(rag, /\/api\/embed/);
  assert.match(rag, /INSERT INTO document_chunks/);
  assert.match(rag, /cosineSimilarity/);
  assert.match(rag, /\/api\/chat/);
  assert.match(rag, /ensureCitations/);
  assert.match(route, /answerWithLocalModel/);
  assert.match(route, /local_vector_search/);
  assert.match(indexRoute, /localAIHealth/);
  assert.match(migration, /CREATE TABLE `document_chunks`/);
  assert.match(page, /fetch(WithAuth)?\("\/api\/chat"/);
  assert.match(page, /Extracting, embedding, retrieving/);
  assert.match(page, /item\.sources/);
  assert.match(page, /document\.chunkCount/);
  assert.match(packageJson, /"unpdf"/);
  assert.match(packageJson, /"local:setup"/);
  assert.match(readme, /fully local document RAG/i);
});

test("chunks pages, ranks vectors, and enforces citations deterministically", () => {
  const chunks = chunkPages([
    { page: 1, text: "Kashika leads customer research. ".repeat(60) },
    { page: 2, text: "She converts findings into product requirements. ".repeat(30) },
  ], { chunkSize: 300, overlap: 50 });
  assert.ok(chunks.length > 3);
  assert.equal(chunks[0].page, 1);
  assert.ok(chunks.some((chunk) => chunk.page === 2));
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(cosineSimilarity([1, 0], [1, 0]) > 0.99);
  assert.ok(cosineSimilarity([1, 0], [0, 1]) < 0.01);

  const matches = [{
    citation: "[S1]",
    documentName: "team.pdf",
    page: 2,
    text: "Kashika leads customer research.",
  }];
  assert.match(buildGroundedPrompt("What does Kashika do?", matches), /\[S1\][\s\S]*team\.pdf[\s\S]*page: 2/);
  assert.match(ensureCitations("Kashika leads research.", matches), /\[S1\] team\.pdf, page 2/);
  assert.equal(ensureCitations("Kashika leads research [S1].", matches), "Kashika leads research [S1].");
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
