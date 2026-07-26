"use client";

import { useMemo, useState } from "react";
import {
  agentRows,
  connectors,
  modelRows,
  navItems,
  platformModules,
  workflowRows,
} from "./platform-data";

type View = (typeof navItems)[number][0];

const pipeline = ["Upload", "OCR", "Clean", "Detect", "Chunk", "PII", "Embed", "Index", "Ready"];

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
}

function Dot({ tone = "green" }: { tone?: "green" | "amber" | "blue" | "red" }) {
  return <span className={`dot dot-${tone}`} aria-hidden="true" />;
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

function Metric({
  label,
  value,
  delta,
  detail,
}: {
  label: string;
  value: string;
  delta?: string;
  detail?: string;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">
        {delta && <span className="metric-delta">{delta}</span>}
        <span>{detail}</span>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="section-actions">{action}</div>}
    </div>
  );
}

function Overview({ navigate }: { navigate: (view: View) => void }) {
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="status-pill"><Dot /> All data remains inside your infrastructure</div>
          <h1>The control plane for your private AI estate.</h1>
          <p>
            Ingest enterprise knowledge, route workloads across local models, deploy governed
            agents, and observe every request—from one secure platform.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate("gateway")}>Open AI Gateway <span>→</span></button>
            <button className="btn btn-secondary" onClick={() => navigate("modules")}>Explore all 21 modules</button>
          </div>
          <div className="trust-row">
            <span><Dot /> Air-gapped ready</span>
            <span><Dot /> OpenAI compatible</span>
            <span><Dot /> 100% local inference</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Private AI request flow">
          <div className="flow-title"><span>LIVE REQUEST FLOW</span><Tag tone="green">Healthy</Tag></div>
          <div className="flow-node node-client">
            <span className="node-icon">API</span>
            <span><b>Client applications</b><small>OpenAI-compatible endpoint</small></span>
            <span className="flow-rate">842 r/s</span>
          </div>
          <div className="flow-line"><span /></div>
          <div className="flow-node node-gateway">
            <span className="node-icon accent">GW</span>
            <span><b>Private AI Gateway</b><small>Policy · Routing · Observability</small></span>
            <span className="flow-rate accent-text">12 ms</span>
          </div>
          <div className="branch-lines"><i /><i /><i /></div>
          <div className="model-nodes">
            <div><b>Qwen3 8B</b><small>Fast Q&A</small><em>43%</em></div>
            <div><b>Qwen3 32B</b><small>Reasoning</small><em>68%</em></div>
            <div><b>Mistral</b><small>Extraction</small><em>12%</em></div>
          </div>
          <div className="data-boundary">PRIVATE NETWORK BOUNDARY · NO EXTERNAL EGRESS</div>
        </div>
      </section>

      <div className="metric-grid">
        <Metric label="Indexed knowledge" value="12.8M" delta="+284K" detail="this month" />
        <Metric label="AI requests" value="4.2M" delta="+18.6%" detail="30 days" />
        <Metric label="Retrieval P95" value="384ms" delta="−42ms" detail="target <500ms" />
        <Metric label="Platform uptime" value="99.98%" delta="SLA met" detail="90 days" />
      </div>

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <div><span className="kicker">KNOWLEDGE PIPELINE</span><h2>Ingestion activity</h2></div>
            <button className="text-btn" onClick={() => navigate("knowledge")}>View knowledge →</button>
          </div>
          <div className="pipeline">
            {pipeline.map((step, index) => (
              <div className="pipeline-step" key={step}>
                <span className={index === 8 ? "current" : ""}>{index < 8 ? "✓" : "●"}</span>
                <small>{step}</small>
              </div>
            ))}
          </div>
          <div className="activity-list">
            {[
              ["FY26_Governance_Policy.pdf", "Legal", "Indexed", "18 sec ago"],
              ["engineering-handbook", "GitHub", "Processing", "1 min ago"],
              ["Customer-Support-Archive.zip", "Support", "OCR", "4 min ago"],
            ].map((row) => (
              <div className="activity-row" key={row[0]}>
                <span className="file-icon">{row[0].includes(".") ? "DOC" : "REPO"}</span>
                <span><b>{row[0]}</b><small>{row[1]}</small></span>
                <Tag tone={row[2] === "Indexed" ? "green" : "blue"}>{row[2]}</Tag>
                <time>{row[3]}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div><span className="kicker">INFRASTRUCTURE</span><h2>Compute fabric</h2></div>
            <button className="text-btn" onClick={() => navigate("infrastructure")}>Open cluster →</button>
          </div>
          <div className="cluster-health">
            <div className="donut"><span><b>74%</b><small>GPU</small></span></div>
            <div className="cluster-stats">
              <div><span>GPU memory</span><b>612 / 800 GB</b></div>
              <div className="bar"><i style={{ width: "76%" }} /></div>
              <div><span>Request queue</span><b>126</b></div>
              <div className="bar"><i style={{ width: "31%" }} /></div>
              <div><span>Cache hit rate</span><b>87.4%</b></div>
              <div className="bar"><i style={{ width: "87%" }} /></div>
            </div>
          </div>
          <div className="health-strip"><span><Dot /> 12 nodes healthy</span><span>4 model servers</span><span>0 critical alerts</span></div>
        </section>
      </div>
    </>
  );
}

function Gateway() {
  const [routing, setRouting] = useState(true);
  const [selected, setSelected] = useState("Balanced routing");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <SectionHeader
        eyebrow="PRIVATE AI GATEWAY"
        title="One secure gateway. Any local model."
        description="Keep client applications stable while administrators route, govern, and observe every private inference request."
        action={<button className="btn btn-primary">+ Create route</button>}
      />
      <div className="metric-grid">
        <Metric label="Requests / second" value="842" delta="+8.2%" detail="live" />
        <Metric label="Gateway overhead" value="12ms" delta="P95" detail="policy + route" />
        <Metric label="Cache hit rate" value="87.4%" delta="+3.1%" detail="24 hours" />
        <Metric label="External egress" value="0 B" delta="Enforced" detail="all workloads" />
      </div>
      <div className="gateway-layout">
        <section className="panel routing-card">
          <div className="panel-head">
            <div><span className="kicker">ROUTING POLICY</span><h2>Production gateway</h2></div>
            <button className={`toggle ${routing ? "on" : ""}`} aria-label="Toggle routing policy" aria-pressed={routing} onClick={() => setRouting(!routing)}><span /></button>
          </div>
          <div className="endpoint-box">
            <span>BASE URL</span>
            <code>https://private-ai.company/v1</code>
            <button onClick={async () => {
              const success = await copyText("https://private-ai.company/v1");
              setCopied(success);
              window.setTimeout(() => setCopied(false), 1800);
            }}>{copied ? "Copied!" : "Copy"}</button>
          </div>
          <label className="field-label">ROUTING STRATEGY</label>
          <div className="segmented">
            {["Cost optimized", "Balanced routing", "Quality first"].map((item) => (
              <button className={selected === item ? "active" : ""} key={item} onClick={() => setSelected(item)}>{item}</button>
            ))}
          </div>
          <div className="rules-list">
            {[
              ["Simple Q&A", "Qwen3 8B", "≤ 8K context", "green"],
              ["Complex reasoning", "Qwen3 32B", "reasoning = high", "blue"],
              ["Document extraction", "Mistral Small", "structured output", "amber"],
              ["Fallback", "Qwen3 32B", "on timeout / error", "neutral"],
            ].map((r) => (
              <div className="rule-row" key={r[0]}>
                <Dot tone={r[3] === "neutral" ? "blue" : r[3] as "green" | "blue" | "amber"} />
                <span><b>{r[0]}</b><small>{r[2]}</small></span>
                <span className="rule-arrow">→</span>
                <Tag tone={r[3]}>{r[1]}</Tag>
                <button aria-label={`More options for ${r[0]}`}>•••</button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel request-card">
          <div className="panel-head"><div><span className="kicker">LIVE TELEMETRY</span><h2>Request stream</h2></div><Tag tone="green"><Dot /> Live</Tag></div>
          <div className="request-chart">
            {[30, 48, 38, 66, 54, 81, 64, 72, 61, 87, 74, 94, 79, 88, 83, 96, 76, 92, 85, 98].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}
          </div>
          <div className="request-log">
            {[
              ["200", "chat.completions", "qwen3-8b", "621ms"],
              ["200", "embeddings", "qwen3-embed", "82ms"],
              ["200", "chat.completions", "qwen3-32b", "1.9s"],
              ["200", "agents.run", "mistral-small", "1.1s"],
              ["429", "chat.completions", "rate-limited", "3ms"],
            ].map((r, i) => <div key={i}><Tag tone={r[0] === "200" ? "green" : "amber"}>{r[0]}</Tag><code>{r[1]}</code><span>{r[2]}</span><time>{r[3]}</time></div>)}
          </div>
        </section>
      </div>
    </>
  );
}

function Knowledge() {
  const [showUpload, setShowUpload] = useState(false);
  const docs = [
    ["Corporate Governance Policy", "PDF · 2.8 MB", "Legal", "v4", "Indexed", "2 min ago"],
    ["Engineering Handbook", "GitHub · 428 files", "Engineering", "main", "Synced", "12 min ago"],
    ["FY26 Financial Model", "XLSX · 18.4 MB", "Finance", "v7", "Indexed", "1 hour ago"],
    ["Customer Support Archive", "ZIP · 4.2 GB", "Support", "v2", "Processing", "3 hours ago"],
    ["All Hands — July", "Video · 1h 14m", "People", "v1", "Transcribing", "Yesterday"],
  ];
  return (
    <>
      <SectionHeader eyebrow="KNOWLEDGE MANAGEMENT" title="Your enterprise memory, governed." description="Ingest, process, classify, and retrieve every approved source without moving data outside your infrastructure." action={<><button className="btn btn-secondary">Connect source</button><button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>↑ Upload</button></>} />
      {showUpload && (
        <div className="upload-zone">
          <span className="upload-icon">↑</span><div><b>Drop files or folders here</b><small>PDF, Office, images, audio, video, archives, and repositories</small></div><button className="btn btn-secondary" onClick={() => setShowUpload(false)}>Choose files</button>
        </div>
      )}
      <div className="metric-grid">
        <Metric label="Documents" value="12,842,719" delta="+284K" detail="30 days" />
        <Metric label="Storage used" value="18.6 TB" delta="62%" detail="of 30 TB" />
        <Metric label="Processing queue" value="1,248" delta="12 workers" detail="18m ETA" />
        <Metric label="Index freshness" value="99.2%" delta="Healthy" detail="<15 min lag" />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-field"><span>⌕</span><input aria-label="Search knowledge" placeholder="Search documents, owners, or tags…" /></div>
          <button className="filter-btn">All sources⌄</button><button className="filter-btn">All teams⌄</button><button className="filter-btn">Status⌄</button>
        </div>
        <div className="data-table knowledge-table">
          <div className="table-row table-head"><span>Name</span><span>Owner</span><span>Version</span><span>Status</span><span>Updated</span><span /></div>
          {docs.map((d) => <div className="table-row" key={d[0]}><span className="doc-name"><i>{d[1].slice(0, 3).toUpperCase()}</i><b>{d[0]}<small>{d[1]}</small></b></span><span>{d[2]}</span><span>{d[3]}</span><span><Tag tone={d[4] === "Indexed" || d[4] === "Synced" ? "green" : "blue"}>{d[4]}</Tag></span><time>{d[5]}</time><button>•••</button></div>)}
        </div>
        <div className="table-footer"><span>Showing 5 of 12,842,719 documents</span><div><button disabled>←</button><button>1</button><button>2</button><button>3</button><button>→</button></div></div>
      </section>
    </>
  );
}

function SearchView() {
  const [query, setQuery] = useState("remote work security policy");
  const [saved, setSaved] = useState(false);
  return (
    <>
      <SectionHeader eyebrow="ENTERPRISE SEARCH" title="Find the answer, not just a file." description="Hybrid semantic and keyword retrieval across every authorized enterprise source." />
      <div className="search-hero">
        <div className="main-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search all enterprise knowledge" /><kbd>⌘ K</kbd><button>Search</button></div>
        <div className="search-options"><Tag tone="blue">Hybrid search</Tag><span>Scope: All knowledge</span><span>Sort: Relevance</span><button onClick={() => setSaved(!saved)}>{saved ? "★ Saved" : "☆ Save search"}</button></div>
      </div>
      <div className="search-layout">
        <aside className="filter-panel">
          <span className="kicker">FILTERS</span>
          {["Date range", "Department", "Source", "Author", "Tags", "File type"].map((f, i) => <div className="filter-group" key={f}><b>{f}<span>⌄</span></b>{i < 3 && <>{["Any time", "Engineering", "Legal"].slice(0, i + 1).map(x => <label key={x}><input type="checkbox" /> {x}</label>)}</>}</div>)}
        </aside>
        <section className="results">
          <div className="results-head"><span><b>248 results</b> · 384ms</span><span>Semantic <b>70%</b> + Keyword <b>30%</b></span></div>
          {[
            ["Remote Work Security & Access Policy", "Corporate Security", "PDF", "Employees working remotely must use a managed device and connect through the corporate VPN. Access to sensitive repositories requires multi-factor authentication…", "98%"],
            ["Engineering Handbook — Secure Development", "Engineering", "GitHub", "Remote development environments follow zero-trust access principles. Production credentials must never be stored on local devices…", "94%"],
            ["Information Security Standard v6.2", "Risk & Compliance", "DOCX", "All off-premises access is subject to device posture verification, IP restrictions, and continuous session monitoring…", "91%"],
            ["Remote Workspace FAQ", "People Operations", "Notion", "Guidance for setting up a compliant home workspace, requesting approved hardware, and reporting security incidents…", "86%"],
          ].map((r, i) => <article className="result-card" key={r[0]}><div className="result-rank">0{i + 1}</div><div><div className="result-meta"><Tag>{r[2]}</Tag><span>{r[1]}</span><span>Updated {i + 2} days ago</span></div><h3>{r[0]}</h3><p>{r[3]}</p><div className="result-bottom"><span>Matched: <mark>remote</mark> · <mark>security</mark> · <mark>access</mark></span><button>Open source ↗</button></div></div><strong>{r[4]}<small>match</small></strong></article>)}
        </section>
      </div>
    </>
  );
}

function ChatView() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { role: "user", text: "Summarize our remote work security requirements for engineering managers." },
    { role: "ai", text: "Engineering managers should enforce four controls: managed devices, corporate VPN access, MFA for sensitive repositories, and continuous device posture verification. Production credentials may not be stored locally, and security incidents must be reported immediately.", sources: ["Remote Work Security Policy · p. 6", "Engineering Handbook · §4.2", "Security Standard v6.2 · p. 18"] },
  ]);
  const send = () => {
    if (!message.trim()) return;
    setMessages([...messages, { role: "user", text: message }, { role: "ai", text: "I found the relevant approved sources. Based on your access level, I can provide a grounded answer with citations while keeping this request entirely inside the private cluster.", sources: ["Approved knowledge base · 3 matches"] }]);
    setMessage("");
  };
  return (
    <div className="chat-shell">
      <aside className="threads-panel">
        <button className="btn btn-primary new-chat">+ New conversation</button>
        <span className="kicker">TODAY</span>
        {["Remote security requirements", "Q3 revenue variance", "SOC 2 evidence checklist"].map((t, i) => <button className={`thread ${i === 0 ? "active" : ""}`} key={t}><span>✦</span><b>{t}</b><small>{i * 12 + 2}m</small></button>)}
        <span className="kicker">PREVIOUS 7 DAYS</span>
        {["Project Atlas status", "Vendor contract risks", "Incident INC-2841"].map(t => <button className="thread" key={t}><span>✦</span><b>{t}</b><small>•••</small></button>)}
      </aside>
      <section className="chat-main">
        <div className="chat-head"><div><h2>Remote security requirements</h2><span><Dot /> Private · Qwen3 32B · 3 knowledge bases</span></div><div><button>☆</button><button>Share</button><button>Export</button><button>•••</button></div></div>
        <div className="messages">
          {messages.map((m, i) => <div className={`message ${m.role}`} key={i}><div className="avatar">{m.role === "ai" ? "PA" : "PG"}</div><div><span className="message-author">{m.role === "ai" ? "PrivateAI" : "You"}</span><p>{m.text}</p>{m.sources && <div className="citations"><b>Sources</b>{m.sources.map((s, j) => <button key={s}><span>{j + 1}</span>{s}<em>↗</em></button>)}</div>}{m.role === "ai" && <div className="message-tools"><button>Copy</button><button>Good</button><button>Bad</button><button>Regenerate</button></div>}</div></div>)}
        </div>
        <div className="composer"><textarea aria-label="Message PrivateAI" placeholder="Ask anything across your private knowledge…" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} /><div><span>＋ Attach</span><span>⌘ Knowledge: All</span><button onClick={send}>↑</button></div></div>
        <small className="chat-disclaimer">Responses are generated locally and may require verification. Sources remain within your infrastructure.</small>
      </section>
    </div>
  );
}

function Agents() {
  return (
    <>
      <SectionHeader eyebrow="AI AGENTS" title="Deploy specialists, not shadow AI." description="Purpose-built agents inherit user permissions, approved tools, knowledge scopes, and complete auditability." action={<button className="btn btn-primary">+ Build agent</button>} />
      <div className="agent-hero panel">
        <div><Tag tone="blue">LANGGRAPH ORCHESTRATION</Tag><h2>Agents that reason inside your boundaries.</h2><p>Every tool call, retrieval, model decision, and human approval is observable and governed by policy.</p><div className="hero-actions"><button className="btn btn-primary">Open agent studio</button><button className="btn btn-secondary">Browse templates</button></div></div>
        <div className="agent-flow"><div className="agent-core">AGENT<small>Plan · Reason · Act</small></div><span className="orbit one">Knowledge</span><span className="orbit two">Tools</span><span className="orbit three">Approvals</span><span className="orbit four">Memory</span></div>
      </div>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">DEPLOYED AGENTS</span><h2>Agent fleet</h2></div><div className="search-field compact"><span>⌕</span><input placeholder="Find agent…" /></div></div>
        <div className="data-table agent-table"><div className="table-row table-head"><span>Agent</span><span>Purpose</span><span>Runs / 30d</span><span>Success</span><span>Status</span><span /></div>{agentRows.map((a) => <div className="table-row" key={a[0]}><span className="doc-name"><i>AI</i><b>{a[0]}<small>Qwen3 32B · RAG enabled</small></b></span><span>{a[1]}</span><span>{a[2]}</span><span>{a[3]}</span><span><Tag tone={a[4] === "Active" ? "green" : "amber"}>{a[4]}</Tag></span><button>•••</button></div>)}</div>
      </section>
    </>
  );
}

function Workflows() {
  const [runs, setRuns] = useState(1842);
  return (
    <>
      <SectionHeader eyebrow="WORKFLOW AUTOMATION" title="Turn intelligence into governed action." description="Compose AI, enterprise systems, and human approvals into reliable private workflows." action={<button className="btn btn-primary" onClick={() => setRuns(runs + 1)}>+ New workflow</button>} />
      <div className="metric-grid"><Metric label="Workflow runs" value={runs.toLocaleString()} delta="+14.2%" detail="30 days" /><Metric label="Hours saved" value="4,286" delta="+382h" detail="this month" /><Metric label="Success rate" value="97.8%" delta="+0.6%" detail="30 days" /><Metric label="Awaiting approval" value="18" delta="4 urgent" detail="human tasks" /></div>
      <section className="panel workflow-builder">
        <div className="panel-head"><div><span className="kicker">VISUAL ORCHESTRATION</span><h2>Compliance report workflow</h2></div><div><button className="btn btn-secondary">Test run</button><button className="btn btn-primary">Publish</button></div></div>
        <div className="workflow-canvas">
          {[["01", "Trigger", "New document indexed"], ["02", "Detect PII", "Local classifier"], ["03", "Assess risk", "Legal agent"], ["04", "Human approval", "Compliance team"], ["05", "Create report", "PDF + audit record"]].map((n, i) => <div className="workflow-node" key={n[0]}><small>{n[0]}</small><span className={`wf-icon wf-${i}`}>{i === 0 ? "⚡" : i === 3 ? "✓" : "AI"}</span><b>{n[1]}</b><em>{n[2]}</em>{i < 4 && <i className="connector">→</i>}</div>)}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">AUTOMATIONS</span><h2>Production workflows</h2></div><button className="filter-btn">All status⌄</button></div>
        <div className="data-table workflow-table"><div className="table-row table-head"><span>Workflow</span><span>Scope</span><span>Trigger</span><span>Decision</span><span>Status</span><span /></div>{workflowRows.map(w => <div className="table-row" key={w[0]}><span><b>{w[0]}</b></span><span>{w[1]}</span><span>{w[2]}</span><span>{w[3]}</span><span><Tag tone={w[4] === "Running" ? "green" : "amber"}>{w[4]}</Tag></span><button>•••</button></div>)}</div>
      </section>
    </>
  );
}

function Models() {
  const [active, setActive] = useState("Qwen3 32B");
  return (
    <>
      <SectionHeader eyebrow="MODELS & COMPUTE" title="Your models. Your GPUs. Your control." description="Install, benchmark, tune, route, version, and roll back every locally served model." action={<><button className="btn btn-secondary">Run benchmark</button><button className="btn btn-primary">+ Install model</button></>} />
      <div className="metric-grid"><Metric label="Models installed" value="8" delta="4 serving" detail="2 warm, 2 offline" /><Metric label="GPU utilization" value="74%" delta="12 GPUs" detail="800 GB VRAM" /><Metric label="Tokens / second" value="2,842" delta="+12.4%" detail="cluster total" /><Metric label="Fine-tuning jobs" value="2" delta="1 LoRA" detail="running now" /></div>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">MODEL REGISTRY</span><h2>Serving models</h2></div><div className="search-field compact"><span>⌕</span><input placeholder="Search models…" /></div></div>
        <div className="model-list">
          {modelRows.map(m => <article className={`model-row ${active === m.name ? "selected" : ""}`} key={m.name} onClick={() => setActive(m.name)}><div className="model-mark">{m.name.slice(0, 1)}</div><div className="model-info"><h3>{m.name}</h3><p>{m.role}</p><div><Tag tone={m.status === "Serving" ? "green" : "amber"}><Dot /> {m.status}</Tag><span>{m.gpu}</span><span>{m.context} context</span></div></div><div className="model-load"><span><b>{m.load}%</b> GPU</span><div className="bar"><i style={{ width: `${m.load}%` }} /></div></div><div className="model-latency"><b>{m.latency}</b><span>P95 latency</span></div><button aria-label={`More options for ${m.name}`}>•••</button></article>)}
        </div>
      </section>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">FINE-TUNING</span><h2>Active jobs</h2></div><button className="text-btn">View all →</button></div><div className="job-card"><div><Tag tone="blue">LoRA</Tag><b>legal-contract-v3</b><small>Qwen3 32B · 42,800 samples</small></div><span>Epoch 2 / 3 <b>68%</b></span><div className="bar"><i style={{ width: "68%" }} /></div></div></section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">VERSION CONTROL</span><h2>Deployment safety</h2></div></div><div className="safety-grid"><div><b>8</b><span>Versioned models</span></div><div><b>2</b><span>Rollback points</span></div><div><b>100%</b><span>Health checked</span></div></div></section>
      </div>
    </>
  );
}

function Integrations() {
  return (
    <>
      <SectionHeader eyebrow="INTEGRATIONS" title="Connect knowledge where it already lives." description="Secure, incremental connectors preserve source permissions and keep private indexes fresh." action={<button className="btn btn-primary">+ Add integration</button>} />
      <div className="integration-stats"><span><Dot /> 6 connected</span><span><Dot tone="blue" /> 1 syncing</span><span>Last full sync: 8 minutes ago</span><button>Sync all</button></div>
      <div className="connector-grid">{connectors.map((c, i) => <article className="connector-card" key={c[0]}><div className={`connector-logo logo-${i}`}>{c[0].slice(0, 2).toUpperCase()}</div><div><h3>{c[0]}</h3><p>{c[1]}</p></div><Tag tone={c[2] === "Connected" ? "green" : c[2] === "Syncing" ? "blue" : "neutral"}>{c[2]}</Tag><div className="connector-foot"><span>{c[3]}</span><button>{c[2] === "Available" ? "Connect" : "Manage"}</button></div></article>)}</div>
      <section className="panel sync-panel"><div><span className="kicker">CONNECTOR FRAMEWORK</span><h2>Built for continuous, permission-aware sync</h2><p>Delta indexing, retry queues, source ACL mirroring, webhook ingestion, and complete sync observability are included.</p></div><div className="sync-features">{["Incremental updates", "Delta indexing", "Permission sync", "Retry mechanism", "Dead-letter queue", "Audit logging"].map(f => <Tag tone="blue" key={f}>✓ {f}</Tag>)}</div></section>
    </>
  );
}

function Developers() {
  const [lang, setLang] = useState("curl");
  const [copied, setCopied] = useState(false);
  const code: Record<string, string> = {
    curl: `curl https://private-ai.company/v1/chat/completions \\\n  -H "Authorization: Bearer $PRIVATE_AI_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "auto",\n    "messages": [{"role": "user", "content": "Hello"}],\n    "knowledge_base": "engineering"\n  }'`,
    python: `from privateai import PrivateAI\n\nclient = PrivateAI(base_url=PRIVATE_AI_URL)\nresponse = client.chat.completions.create(\n    model="auto",\n    messages=[{"role": "user", "content": "Hello"}]\n)`,
    node: `import PrivateAI from "@privateai/sdk";\n\nconst client = new PrivateAI({ baseURL: PRIVATE_AI_URL });\nconst response = await client.chat.completions.create({\n  model: "auto", messages: [{ role: "user", content: "Hello" }]\n});`,
  };
  return (
    <>
      <SectionHeader eyebrow="DEVELOPER PLATFORM" title="OpenAI compatible. Infrastructure independent." description="Move existing applications onto private inference by changing one base URL—then unlock agents, search, documents, and workflows." action={<><button className="btn btn-secondary">API reference ↗</button><button className="btn btn-primary">+ Create API key</button></>} />
      <div className="dev-layout">
        <section className="panel endpoint-list"><span className="kicker">API ENDPOINTS</span>{["/v1/chat/completions", "/v1/embeddings", "/v1/documents", "/v1/search", "/v1/workflows", "/v1/agents", "/v1/models"].map((e, i) => <button className={i === 0 ? "active" : ""} key={e}><Tag tone={i < 2 ? "green" : "blue"}>{i < 2 ? "POST" : i === 6 ? "GET" : "POST"}</Tag><code>{e}</code><span>›</span></button>)}</section>
        <section className="code-panel"><div className="code-tabs">{["curl", "python", "node"].map(l => <button className={lang === l ? "active" : ""} onClick={() => setLang(l)} key={l}>{l === "node" ? "Node.js" : l[0].toUpperCase() + l.slice(1)}</button>)}<button className="copy-code" onClick={async () => {
          const success = await copyText(code[lang]);
          setCopied(success);
          window.setTimeout(() => setCopied(false), 1800);
        }}>{copied ? "Copied!" : "Copy"}</button></div><pre><code>{code[lang]}</code></pre><div className="code-status"><Dot /> Runs entirely inside your private network</div></section>
      </div>
      <div className="sdk-grid">{[["PY", "Python SDK", "pip install privateai"], ["JS", "Node SDK", "npm i @privateai/sdk"], ["JV", "Java SDK", "com.privateai:sdk"], ["GO", "Go SDK", "go get privateai.dev/go"]].map(s => <article className="sdk-card" key={s[0]}><i>{s[0]}</i><div><b>{s[1]}</b><code>{s[2]}</code></div><button>View docs →</button></article>)}</div>
    </>
  );
}

function Analytics() {
  return (
    <>
      <SectionHeader eyebrow="ANALYTICS & OBSERVABILITY" title="Know exactly how private AI performs." description="One view across adoption, answer quality, inference, retrieval, infrastructure, agents, and risk." action={<button className="filter-btn">Last 30 days⌄</button>} />
      <div className="metric-grid"><Metric label="Active users" value="8,428" delta="+12.8%" detail="82% adoption" /><Metric label="Total queries" value="4.2M" delta="+18.6%" detail="30 days" /><Metric label="Search success" value="94.7%" delta="+2.4%" detail="grounded result" /><Metric label="Error rate" value="0.08%" delta="−0.03%" detail="all services" /></div>
      <div className="analytics-grid">
        <section className="panel chart-panel"><div className="panel-head"><div><span className="kicker">REQUEST VOLUME</span><h2>Queries & agent runs</h2></div><div><Tag tone="blue">● Queries</Tag><Tag>● Agents</Tag></div></div><div className="line-chart"><div className="y-labels"><span>200K</span><span>150K</span><span>100K</span><span>50K</span><span>0</span></div><div className="chart-bars">{[54, 61, 48, 72, 69, 84, 76, 88, 81, 96, 90, 99].map((h, i) => <div key={i}><i style={{ height: `${h}%` }} /><em style={{ height: `${h * .42}%` }} /></div>)}</div></div><div className="x-labels"><span>Jul 1</span><span>Jul 8</span><span>Jul 15</span><span>Jul 22</span><span>Jul 26</span></div></section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">SYSTEM HEALTH</span><h2>Resource utilization</h2></div><Tag tone="green"><Dot /> Healthy</Tag></div>{[["GPU", "74%", 74], ["CPU", "48%", 48], ["Memory", "62%", 62], ["Storage", "18.6 / 30 TB", 62]].map(x => <div className="resource-row" key={x[0]}><div><span>{x[0]}</span><b>{x[1]}</b></div><div className="bar"><i style={{ width: `${x[2]}%` }} /></div></div>)}<div className="mini-health"><span><b>12/12</b> nodes</span><span><b>99.98%</b> uptime</span><span><b>0</b> critical</span></div></section>
      </div>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">TOP QUESTIONS</span><h2>What employees ask</h2></div></div>{["Expense policy for international travel", "How do I request production access?", "Q3 revenue versus forecast", "Remote work security requirements"].map((q, i) => <div className="rank-row" key={q}><span>0{i + 1}</span><b>{q}</b><em>{(8421 - i * 1249).toLocaleString()}</em></div>)}</section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">AGENT USAGE</span><h2>Runs by specialist</h2></div></div>{agentRows.slice(0, 4).map((a, i) => <div className="agent-usage" key={a[0]}><span>{a[0]}</span><div className="bar"><i style={{ width: `${92 - i * 14}%` }} /></div><b>{a[2]}</b></div>)}</section>
      </div>
    </>
  );
}

function Security() {
  const [maintenance, setMaintenance] = useState(false);
  return (
    <>
      <SectionHeader eyebrow="SECURITY & ADMINISTRATION" title="Private by architecture. Governed by design." description="Identity, encryption, policy, auditing, compliance, and platform administration in one control plane." action={<button className="btn btn-primary">Review security posture</button>} />
      <div className="posture-banner"><div className="posture-score">96<span>/100</span></div><div><Tag tone="green">STRONG POSTURE</Tag><h2>All critical controls are enforced</h2><p>2 recommendations remain. No high-severity findings detected.</p></div><button className="btn btn-secondary">View recommendations</button></div>
      <div className="security-grid">
        {[
          ["Identity & Access", "SSO, LDAP, MFA, RBAC", "14 / 14 controls", 100],
          ["Data Protection", "AES-256, TLS 1.3, secrets", "12 / 12 controls", 100],
          ["API Security", "Keys, rate limits, IP policy", "9 / 10 controls", 90],
          ["File Security", "Malware, validation, watermark", "8 / 9 controls", 89],
          ["Compliance", "SOC 2, GDPR, ISO 27001", "32 / 34 controls", 94],
          ["Audit & Sessions", "Devices, sessions, immutable logs", "11 / 11 controls", 100],
        ].map(s => <article className="security-card" key={s[0]}><div className="security-icon">◈</div><div><h3>{s[0]}</h3><p>{s[1]}</p></div><span>{s[2]}</span><div className="bar"><i style={{ width: `${s[3]}%` }} /></div><button>Configure →</button></article>)}
      </div>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">RECENT AUDIT EVENTS</span><h2>Immutable activity log</h2></div><button className="text-btn">Open audit log →</button></div>{[["API key created", "priya.shah@company.com", "2 min ago"], ["Model route updated", "platform-admin", "18 min ago"], ["Bulk export approved", "legal-reviewers", "1 hour ago"], ["MFA policy enforced", "security-admin", "3 hours ago"]].map(a => <div className="audit-row" key={a[0]}><Dot /><span><b>{a[0]}</b><small>{a[1]}</small></span><time>{a[2]}</time></div>)}</section>
        <section className="panel admin-settings"><div className="panel-head"><div><span className="kicker">SYSTEM ADMINISTRATION</span><h2>Platform controls</h2></div></div>{[["SMTP", "smtp.internal.company", true], ["Automated backups", "Daily · 02:00", true], ["License", "Enterprise · 10,000 seats", true]].map(x => <div key={x[0]}><span><b>{x[0]}</b><small>{x[1]}</small></span><Tag tone="green">Configured</Tag></div>)}<div><span><b>Maintenance mode</b><small>Restrict access to administrators</small></span><button className={`toggle ${maintenance ? "on" : ""}`} aria-label="Toggle maintenance mode" aria-pressed={maintenance} onClick={() => setMaintenance(!maintenance)}><span /></button></div></section>
      </div>
    </>
  );
}

function Infrastructure() {
  return (
    <>
      <SectionHeader eyebrow="AI INFRASTRUCTURE" title="The private inference fabric." description="Schedule, balance, queue, cache, stream, and observe AI workloads across multi-node GPU clusters." action={<><button className="btn btn-secondary">Open Grafana ↗</button><button className="btn btn-primary">+ Add node</button></>} />
      <div className="cluster-banner"><div><span className="cluster-pulse"><i /><i /><i /></span><div><Tag tone="green">PRODUCTION · HEALTHY</Tag><h2>private-ai-cluster-01</h2><p>Kubernetes 1.32 · On-premises · Air-gapped</p></div></div><div className="cluster-summary"><span><b>12</b> Nodes</span><span><b>24</b> GPUs</span><span><b>800 GB</b> VRAM</span><span><b>99.98%</b> Uptime</span></div></div>
      <div className="infra-grid">
        {[
          ["LLM Server", "vLLM", "4 replicas", "2,842 tok/s"],
          ["Embedding Server", "Qwen3 Embed", "3 replicas", "12.4K vec/s"],
          ["Inference Scheduler", "Priority-aware", "Healthy", "126 queued"],
          ["GPU Scheduler", "Topology-aware", "24 GPUs", "74% utilized"],
          ["Load Balancer", "NGINX", "3 replicas", "842 req/s"],
          ["Request Queue", "Kafka", "12 partitions", "18ms lag"],
          ["Semantic Cache", "Redis", "6 shards", "87.4% hit"],
          ["Streaming Engine", "SSE", "4 replicas", "6.2K streams"],
        ].map((c, i) => <article className="infra-card" key={c[0]}><div className="infra-top"><span className="infra-icon">{String(i + 1).padStart(2, "0")}</span><Tag tone="green"><Dot /> Healthy</Tag></div><h3>{c[0]}</h3><p>{c[1]}</p><div><span>{c[2]}</span><b>{c[3]}</b></div></article>)}
      </div>
      <section className="panel deployment-panel"><div><span className="kicker">DEPLOY ANYWHERE</span><h2>One platform, every enterprise environment.</h2><p>Docker, Kubernetes, Helm, cloud VPC, VMware, bare metal, and fully air-gapped deployment packages.</p></div><div className="deployment-tags">{["Docker", "Kubernetes", "Helm", "AWS", "Azure", "GCP", "VMware", "Bare metal", "Air-gapped"].map(d => <Tag key={d}>{d}</Tag>)}</div></section>
    </>
  );
}

function Modules() {
  const [term, setTerm] = useState("");
  const filtered = useMemo(() => platformModules.filter(m => `${m.name} ${m.description} ${m.features.join(" ")}`.toLowerCase().includes(term.toLowerCase())), [term]);
  const featureCount = platformModules.reduce((sum, m) => sum + m.features.length, 0);
  return (
    <>
      <SectionHeader eyebrow="PLATFORM COVERAGE" title="Every module. Every capability." description={`${platformModules.length} operational modules and ${featureCount} named capabilities from the PrivateAI Platform specification.`} />
      <div className="module-toolbar"><div className="search-field"><span>⌕</span><input value={term} onChange={e => setTerm(e.target.value)} aria-label="Search modules and features" placeholder="Find any module or capability…" /></div><Tag tone="green">{filtered.length} modules shown</Tag></div>
      <div className="module-grid">{filtered.map(m => <article className="module-card" key={m.id}><div className="module-number">{m.number}</div><div className="module-title"><h2>{m.name}</h2><Tag tone="blue">{m.features.length} features</Tag></div><p>{m.description}</p><div className="feature-cloud">{m.features.map(f => <span key={f}>{f}<i>✓</i></span>)}</div><button>Open module <span>→</span></button></article>)}</div>
    </>
  );
}

function AppContent({ view, navigate }: { view: View; navigate: (view: View) => void }) {
  switch (view) {
    case "gateway": return <Gateway />;
    case "knowledge": return <Knowledge />;
    case "search": return <SearchView />;
    case "chat": return <ChatView />;
    case "agents": return <Agents />;
    case "workflows": return <Workflows />;
    case "models": return <Models />;
    case "integrations": return <Integrations />;
    case "developers": return <Developers />;
    case "analytics": return <Analytics />;
    case "security": return <Security />;
    case "infrastructure": return <Infrastructure />;
    case "modules": return <Modules />;
    default: return <Overview navigate={navigate} />;
  }
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand" onClick={() => navigate("overview")} role="button" tabIndex={0}>
          <span className="brand-mark"><i /><i /><i /></span>
          <span><b>PrivateAI</b><small>PLATFORM</small></span>
        </div>
        <div className="environment"><span><Dot /> Production</span><button aria-label="Switch environment">⌄</button></div>
        <nav aria-label="Platform navigation">
          <span className="nav-label">CONTROL PLANE</span>
          {navItems.slice(0, 10).map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><span className="nav-icon">{icon}</span><span>{label}</span>{id === "workflows" && <em>18</em>}</button>)}
          <span className="nav-label">OPERATIONS</span>
          {navItems.slice(10).map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><span className="nav-icon">{icon}</span><span>{label}</span>{id === "modules" && <em className="module-count">21</em>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><span>◈</span><div><b>Private by design</b><small>Zero external egress</small></div><Dot /></div>
          <button className="user-card" onClick={() => announce("Account menu opened")}><span>PG</span><div><b>Prabhat Gupta</b><small>Super Admin</small></div><em>•••</em></button>
        </div>
      </aside>
      {mobileNav && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <button className="menu-btn" aria-label="Open navigation" onClick={() => setMobileNav(true)}>☰</button>
          <div className="breadcrumbs"><span>PrivateAI</span><i>/</i><b>{navItems.find(n => n[0] === view)?.[1]}</b></div>
          <div className="top-actions">
            <button className="global-search" onClick={() => navigate("search")}><span>⌕</span><span>Search everything…</span><kbd>⌘ K</kbd></button>
            <button className="icon-btn" aria-label="Open developer documentation" onClick={() => navigate("developers")}>?</button>
            <button className="icon-btn has-alert" aria-label="Notifications" onClick={() => announce("3 notifications: cluster healthy, sync complete, approval due")}>♧</button>
            <div className="secure-indicator"><Dot /> Secure</div>
          </div>
        </header>
        <main className={view === "chat" ? "content content-chat" : "content"}>
          <AppContent view={view} navigate={navigate} />
        </main>
      </div>
      {notice && <div className="toast"><Dot /> {notice}</div>}
    </div>
  );
}
