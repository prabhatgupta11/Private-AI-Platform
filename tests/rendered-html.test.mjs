import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: {
        accept: "text/html",
        host: "localhost:3000",
      },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete PrivateAI overview", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>PrivateAI Platform — Enterprise AI Infrastructure<\/title>/i,
  );
  assert.match(html, /The control plane for your private AI estate\./);
  assert.match(html, /Private AI Gateway/);
  assert.match(html, /100% local inference/);
  assert.match(html, /PRIVATE NETWORK BOUNDARY · NO EXTERNAL EGRESS/);
  assert.match(html, /Platform uptime/);
  assert.match(html, /99\.98%/);
  assert.match(html, /http:\/\/localhost:3000\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
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
