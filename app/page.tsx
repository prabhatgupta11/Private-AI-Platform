"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type DocumentRecord = {
  id: string;
  name: string;
  objectKey: string;
  size: number;
  contentType: string;
  status: string;
  createdAt: string;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

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

function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <span className="empty-mark">＋</span>
      <div><b>{title}</b><p>{description}</p></div>
      {action}
    </div>
  );
}

function Overview({ navigate, documents }: { navigate: (view: View) => void; documents: DocumentRecord[] }) {
  const storedBytes = documents.reduce((total, document) => total + document.size, 0);
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="status-pill"><Dot /> No external AI provider is connected</div>
          <h1>The control plane for your private AI estate.</h1>
          <p>
            Ingest enterprise knowledge, route workloads across local models, deploy governed
            agents, and observe every request—from one secure platform.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate("knowledge")}>Upload your first document <span>→</span></button>
            <button className="btn btn-secondary" onClick={() => navigate("modules")}>Explore all 21 modules</button>
          </div>
          <div className="trust-row">
            <span><Dot /> Self-hosting ready</span>
            <span><Dot /> OpenAI-compatible design</span>
            <span><Dot /> Local inference when connected</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Private AI request flow">
          <div className="flow-title"><span>PRIVATE AI REQUEST FLOW</span><Tag>Not configured</Tag></div>
          <div className="flow-node node-client">
            <span className="node-icon">API</span>
            <span><b>No client applications</b><small>Create an API key after configuring a model</small></span>
            <span className="flow-rate">0 r/s</span>
          </div>
          <div className="flow-line"><span /></div>
          <div className="flow-node node-gateway">
            <span className="node-icon accent">GW</span>
            <span><b>Private AI Gateway</b><small>Policy · Routing · Observability</small></span>
            <span className="flow-rate">Offline</span>
          </div>
          <div className="branch-lines"><i /><i /><i /></div>
          <div className="model-nodes">
            <div><b>No model</b><small>Fast Q&A</small><em>0%</em></div>
            <div><b>No model</b><small>Reasoning</small><em>0%</em></div>
            <div><b>No model</b><small>Extraction</small><em>0%</em></div>
          </div>
          <div className="data-boundary">DESIGNED FOR PRIVATE NETWORK DEPLOYMENT</div>
        </div>
      </section>

      <div className="metric-grid">
        <Metric label="Uploaded documents" value={documents.length.toLocaleString()} detail="real records" />
        <Metric label="Storage used" value={formatBytes(storedBytes)} detail="private object storage" />
        <Metric label="AI requests" value="0" detail="no model configured" />
        <Metric label="Active workflows" value="0" detail="none created" />
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
                <span>{index === 0 && documents.length > 0 ? "✓" : "○"}</span>
                <small>{step}</small>
              </div>
            ))}
          </div>
          <div className="activity-list">
            {documents.length === 0 ? (
              <EmptyState compact title="No documents yet" description="Upload a document to create your first real knowledge record." action={<button className="text-btn" onClick={() => navigate("knowledge")}>Upload document →</button>} />
            ) : documents.slice(0, 3).map((document) => (
              <div className="activity-row" key={document.id}>
                <span className="file-icon">DOC</span>
                <span><b>{document.name}</b><small>{formatBytes(document.size)}</small></span>
                <Tag tone="green">Stored</Tag>
                <time>{formatDate(document.createdAt)}</time>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div><span className="kicker">INFRASTRUCTURE</span><h2>Compute fabric</h2></div>
            <button className="text-btn" onClick={() => navigate("infrastructure")}>Open cluster →</button>
          </div>
          <EmptyState title="No compute cluster connected" description="Add a GPU node or connect an existing Kubernetes cluster to see live infrastructure metrics." action={<button className="text-btn" onClick={() => navigate("infrastructure")}>Configure infrastructure →</button>} />
        </section>
      </div>
    </>
  );
}

function Gateway() {
  const [routing, setRouting] = useState(false);
  const [selected, setSelected] = useState("Balanced routing");
  return (
    <>
      <SectionHeader
        eyebrow="PRIVATE AI GATEWAY"
        title="One secure gateway. Any local model."
        description="Keep client applications stable while administrators route, govern, and observe every private inference request."
        action={<button className="btn btn-primary">+ Create route</button>}
      />
      <div className="metric-grid">
        <Metric label="Requests / second" value="0" detail="no traffic" />
        <Metric label="Gateway overhead" value="—" detail="no measurements" />
        <Metric label="Cache hit rate" value="—" detail="cache not configured" />
        <Metric label="External egress" value="0 B" detail="no requests" />
      </div>
      <div className="gateway-layout">
        <section className="panel routing-card">
          <div className="panel-head">
            <div><span className="kicker">ROUTING POLICY</span><h2>No active gateway</h2></div>
            <button className={`toggle ${routing ? "on" : ""}`} aria-label="Toggle routing policy" aria-pressed={routing} onClick={() => setRouting(!routing)}><span /></button>
          </div>
          <div className="endpoint-box">
            <span>BASE URL</span>
            <code>Configure a gateway to create an endpoint</code>
            <button disabled>Unavailable</button>
          </div>
          <label className="field-label">ROUTING STRATEGY</label>
          <div className="segmented">
            {["Cost optimized", "Balanced routing", "Quality first"].map((item) => (
              <button className={selected === item ? "active" : ""} key={item} onClick={() => setSelected(item)}>{item}</button>
            ))}
          </div>
          <div className="rules-list"><EmptyState title="No routing rules" description="Install a model, then create a rule for your first workload." /></div>
        </section>
        <section className="panel request-card">
          <div className="panel-head"><div><span className="kicker">LIVE TELEMETRY</span><h2>Request stream</h2></div><Tag>Offline</Tag></div>
          <EmptyState title="No requests recorded" description="Telemetry will appear after a local model and gateway endpoint are active." />
        </section>
      </div>
    </>
  );
}

function Knowledge({
  documents,
  loading,
  loadError,
  reloadDocuments,
}: {
  documents: DocumentRecord[];
  loading: boolean;
  loadError: string;
  reloadDocuments: () => Promise<void>;
}) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [query, setQuery] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const totalBytes = documents.reduce((total, document) => total + document.size, 0);
  const filteredDocuments = documents.filter((document) =>
    document.name.toLowerCase().includes(query.toLowerCase())
  );

  const uploadFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadError("");
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));

    try {
      const response = await fetch("/api/documents", { method: "POST", body });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      await reloadDocuments();
      setShowUpload(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const deleteDocument = async (document: DocumentRecord) => {
    setDeletingId(document.id);
    setUploadError("");
    try {
      const response = await fetch(`/api/documents?id=${encodeURIComponent(document.id)}`, { method: "DELETE" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Delete failed.");
      await reloadDocuments();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <>
      <SectionHeader eyebrow="KNOWLEDGE MANAGEMENT" title="Your enterprise memory, governed." description="Start with a real document. File bytes are stored privately and metadata persists across sessions." action={<><button className="btn btn-secondary">Connect source</button><button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>↑ Upload</button></>} />
      {(showUpload || documents.length === 0) && (
        <div
          className={`upload-zone ${uploading ? "uploading" : ""}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void uploadFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            multiple
            aria-label="Choose documents to upload"
            accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.md,.html,.xml,.json,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.tiff,.mp3,.wav,.m4a,.mp4,.mov,.webm,.zip,.py,.js,.ts,.tsx,.jsx,.java,.go,.rs,.sql,.yaml,.yml"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
            }}
          />
          <span className="upload-icon">↑</span>
          <div><b>Drop files here</b><small>PDF, Office, images, audio, video, archives, and code · up to 50 MB each</small></div>
          <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : "Choose files"}</button>
        </div>
      )}
      {(uploadError || loadError) && <div className="inline-error" role="alert">{uploadError || loadError}</div>}
      <div className="metric-grid">
        <Metric label="Documents" value={documents.length.toLocaleString()} detail="persisted records" />
        <Metric label="Storage used" value={formatBytes(totalBytes)} detail="private object storage" />
        <Metric label="Processing queue" value="0" detail="processing not configured" />
        <Metric label="Indexed" value="0" detail="connect an embedding pipeline" />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search knowledge" placeholder="Search uploaded documents…" /></div>
          <button className="filter-btn">All sources⌄</button><button className="filter-btn">All teams⌄</button><button className="filter-btn">Status⌄</button>
        </div>
        <div className="data-table knowledge-table">
          <div className="table-row table-head"><span>Name</span><span>Owner</span><span>Version</span><span>Status</span><span>Updated</span><span /></div>
          {filteredDocuments.map((document) => <div className="table-row" key={document.id}><span className="doc-name"><i>{document.name.split(".").pop()?.slice(0, 3).toUpperCase() || "DOC"}</i><b>{document.name}<small>{formatBytes(document.size)} · {document.contentType}</small></b></span><span>Local upload</span><span>v1</span><span><Tag tone="green">Stored</Tag></span><time>{formatDate(document.createdAt)}</time><button aria-label={`Delete ${document.name}`} disabled={deletingId === document.id} onClick={() => void deleteDocument(document)}>{deletingId === document.id ? "…" : "Delete"}</button></div>)}
        </div>
        {loading ? <EmptyState compact title="Loading documents" description="Reading your private document library." /> : filteredDocuments.length === 0 && <EmptyState title={query ? "No matching documents" : "No documents uploaded"} description={query ? "Try a different filename." : "Choose a file above to create your first real record."} />}
        <div className="table-footer"><span>Showing {filteredDocuments.length} of {documents.length} documents</span></div>
      </section>
    </>
  );
}

function SearchView() {
  const [query, setQuery] = useState("");
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
          {["Date range", "Department", "Source", "Author", "Tags", "File type"].map(f => <div className="filter-group" key={f}><b>{f}<span>⌄</span></b><small>No indexed values</small></div>)}
        </aside>
        <section className="results">
          <div className="results-head"><span><b>0 results</b></span><span>Search indexing is not configured</span></div>
          <EmptyState title={query ? "Search is not available yet" : "Your search results will appear here"} description={query ? "Your uploaded files are stored, but an embedding model and Qdrant index must be connected before semantic search can run." : "Upload documents, then configure the local embedding and vector-search pipeline."} />
        </section>
      </div>
    </>
  );
}

function ChatView() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; text: string; sources?: string[] }>>([]);
  const send = () => {
    if (!message.trim()) return;
    setMessages([...messages, { role: "user", text: message }, { role: "ai", text: "No local language model is configured. Install or connect a model before sending private AI requests." }]);
    setMessage("");
  };
  return (
    <div className="chat-shell">
      <aside className="threads-panel">
        <button className="btn btn-primary new-chat">+ New conversation</button>
        <span className="kicker">TODAY</span>
        <EmptyState compact title="No conversations" description="Your real thread history will appear here." />
      </aside>
      <section className="chat-main">
        <div className="chat-head"><div><h2>New conversation</h2><span>No model configured · 0 knowledge bases</span></div><div><button>☆</button><button>Share</button><button>Export</button><button>•••</button></div></div>
        <div className="messages">
          {messages.length === 0 && <EmptyState title="Start a private conversation" description="Chat will become available after a local model and knowledge index are configured." />}
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
        <EmptyState title="No agents deployed" description="Install a local model and create an agent when you are ready." />
      </section>
    </>
  );
}

function Workflows() {
  return (
    <>
      <SectionHeader eyebrow="WORKFLOW AUTOMATION" title="Turn intelligence into governed action." description="Compose AI, enterprise systems, and human approvals into reliable private workflows." action={<button className="btn btn-primary">+ New workflow</button>} />
      <div className="metric-grid"><Metric label="Workflow runs" value="0" detail="no runs" /><Metric label="Hours saved" value="0" detail="not measured" /><Metric label="Success rate" value="—" detail="no completed runs" /><Metric label="Awaiting approval" value="0" detail="no human tasks" /></div>
      <section className="panel workflow-builder">
        <div className="panel-head"><div><span className="kicker">VISUAL ORCHESTRATION</span><h2>Workflow canvas</h2></div></div>
        <EmptyState title="No workflow selected" description="Create your first workflow to begin adding triggers, AI steps, and approvals." />
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">AUTOMATIONS</span><h2>Production workflows</h2></div><button className="filter-btn">All status⌄</button></div>
        <div className="data-table workflow-table"><div className="table-row table-head"><span>Workflow</span><span>Scope</span><span>Trigger</span><span>Decision</span><span>Status</span><span /></div>{workflowRows.map(w => <div className="table-row" key={w[0]}><span><b>{w[0]}</b></span><span>{w[1]}</span><span>{w[2]}</span><span>{w[3]}</span><span><Tag tone={w[4] === "Running" ? "green" : "amber"}>{w[4]}</Tag></span><button>•••</button></div>)}</div>
        <EmptyState title="No workflows created" description="Published automations will appear here." />
      </section>
    </>
  );
}

function Models() {
  const [active, setActive] = useState("");
  return (
    <>
      <SectionHeader eyebrow="MODELS & COMPUTE" title="Your models. Your GPUs. Your control." description="Install, benchmark, tune, route, version, and roll back every locally served model." action={<><button className="btn btn-secondary">Run benchmark</button><button className="btn btn-primary">+ Install model</button></>} />
      <div className="metric-grid"><Metric label="Models installed" value="0" detail="none installed" /><Metric label="GPU utilization" value="—" detail="no cluster connected" /><Metric label="Tokens / second" value="0" detail="no inference" /><Metric label="Fine-tuning jobs" value="0" detail="none running" /></div>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">MODEL REGISTRY</span><h2>Serving models</h2></div><div className="search-field compact"><span>⌕</span><input placeholder="Search models…" /></div></div>
        <div className="model-list">
          {modelRows.map(m => <article className={`model-row ${active === m.name ? "selected" : ""}`} key={m.name} onClick={() => setActive(m.name)}><div className="model-mark">{m.name.slice(0, 1)}</div><div className="model-info"><h3>{m.name}</h3><p>{m.role}</p><div><Tag tone={m.status === "Serving" ? "green" : "amber"}><Dot /> {m.status}</Tag><span>{m.gpu}</span><span>{m.context} context</span></div></div><div className="model-load"><span><b>{m.load}%</b> GPU</span><div className="bar"><i style={{ width: `${m.load}%` }} /></div></div><div className="model-latency"><b>{m.latency}</b><span>P95 latency</span></div><button aria-label={`More options for ${m.name}`}>•••</button></article>)}
        </div>
        <EmptyState title="No models installed" description="Install Qwen, Llama, Mistral, DeepSeek, Gemma, Phi, or a custom local model." />
      </section>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">FINE-TUNING</span><h2>Active jobs</h2></div></div><EmptyState compact title="No fine-tuning jobs" description="LoRA jobs will appear after a base model is installed." /></section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">VERSION CONTROL</span><h2>Deployment safety</h2></div></div><div className="safety-grid"><div><b>0</b><span>Versioned models</span></div><div><b>0</b><span>Rollback points</span></div><div><b>—</b><span>Health checked</span></div></div></section>
      </div>
    </>
  );
}

function Integrations() {
  return (
    <>
      <SectionHeader eyebrow="INTEGRATIONS" title="Connect knowledge where it already lives." description="Secure, incremental connectors preserve source permissions and keep private indexes fresh." action={<button className="btn btn-primary">+ Add integration</button>} />
      <div className="integration-stats"><span>0 connected</span><span>0 syncing</span><span>No synchronization has run</span><button disabled>Sync all</button></div>
      <div className="connector-grid">{connectors.map((c, i) => <article className="connector-card" key={c[0]}><div className={`connector-logo logo-${i}`}>{c[0].slice(0, 2).toUpperCase()}</div><div><h3>{c[0]}</h3><p>{c[1]}</p></div><Tag tone={c[2] === "Connected" ? "green" : c[2] === "Syncing" ? "blue" : "neutral"}>{c[2]}</Tag><div className="connector-foot"><span>{c[3]}</span><button>{c[2] === "Available" ? "Connect" : "Manage"}</button></div></article>)}</div>
      <section className="panel sync-panel"><div><span className="kicker">CONNECTOR FRAMEWORK</span><h2>Built for continuous, permission-aware sync</h2><p>Delta indexing, retry queues, source ACL mirroring, webhook ingestion, and complete sync observability are included.</p></div><div className="sync-features">{["Incremental updates", "Delta indexing", "Permission sync", "Retry mechanism", "Dead-letter queue", "Audit logging"].map(f => <Tag tone="blue" key={f}>✓ {f}</Tag>)}</div></section>
    </>
  );
}

function Developers() {
  const [lang, setLang] = useState("curl");
  const [copied, setCopied] = useState(false);
  const code: Record<string, string> = {
    curl: `curl -X POST http://localhost:3000/api/documents \\\n+  -F "files=@document.pdf"`,
    python: `import requests\n\nwith open("document.pdf", "rb") as file:\n    response = requests.post(\n        "http://localhost:3000/api/documents",\n        files={"files": file},\n    )\nprint(response.json())`,
    node: `const form = new FormData();\nform.append("files", fileInput.files[0]);\n\nconst response = await fetch("/api/documents", {\n  method: "POST",\n  body: form,\n});\nconsole.log(await response.json());`,
  };
  return (
    <>
      <SectionHeader eyebrow="DEVELOPER PLATFORM" title="Start with the live document API." description="Document upload, listing, and deletion are available now. Inference, search, agents, and workflows remain on the platform roadmap." action={<button className="btn btn-secondary">API reference ↗</button>} />
      <div className="dev-layout">
        <section className="panel endpoint-list"><span className="kicker">API ENDPOINTS</span>{["/api/documents", "/v1/chat/completions", "/v1/embeddings", "/v1/search", "/v1/workflows", "/v1/agents", "/v1/models"].map((e, i) => <button className={i === 0 ? "active" : ""} disabled={i > 0} key={e}><Tag tone={i === 0 ? "green" : "neutral"}>{i === 0 ? "LIVE" : "PLANNED"}</Tag><code>{e}</code><span>›</span></button>)}</section>
        <section className="code-panel"><div className="code-tabs">{["curl", "python", "node"].map(l => <button className={lang === l ? "active" : ""} onClick={() => setLang(l)} key={l}>{l === "node" ? "Node.js" : l[0].toUpperCase() + l.slice(1)}</button>)}<button className="copy-code" onClick={async () => {
          const success = await copyText(code[lang]);
          setCopied(success);
          window.setTimeout(() => setCopied(false), 1800);
        }}>{copied ? "Copied!" : "Copy"}</button></div><pre><code>{code[lang]}</code></pre><div className="code-status"><Dot /> Live document upload endpoint</div></section>
      </div>
      <section className="panel"><EmptyState title="SDKs are not published yet" description="Use the live HTTP document endpoint today. Language SDKs will appear here only after they are released." /></section>
    </>
  );
}

function Analytics() {
  return (
    <>
      <SectionHeader eyebrow="ANALYTICS & OBSERVABILITY" title="Know exactly how private AI performs." description="One view across adoption, answer quality, inference, retrieval, infrastructure, agents, and risk." action={<button className="filter-btn">Last 30 days⌄</button>} />
      <div className="metric-grid"><Metric label="Active users" value="0" detail="no identity provider" /><Metric label="Total queries" value="0" detail="no AI traffic" /><Metric label="Search success" value="—" detail="no searches" /><Metric label="Error rate" value="—" detail="no requests" /></div>
      <div className="analytics-grid">
        <section className="panel chart-panel"><div className="panel-head"><div><span className="kicker">REQUEST VOLUME</span><h2>Queries & agent runs</h2></div></div><EmptyState title="No request data" description="Analytics will begin after the first real AI request." /></section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">SYSTEM HEALTH</span><h2>Resource utilization</h2></div><Tag>Not connected</Tag></div><EmptyState title="No infrastructure telemetry" description="Connect a compute cluster to collect GPU, CPU, memory, and storage metrics." /></section>
      </div>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">TOP QUESTIONS</span><h2>What employees ask</h2></div></div><EmptyState compact title="No questions yet" description="Popular queries will appear after employees begin using the platform." /></section>
        <section className="panel"><div className="panel-head"><div><span className="kicker">AGENT USAGE</span><h2>Runs by specialist</h2></div></div><EmptyState compact title="No agent usage" description="Create and run an agent to begin collecting usage data." /></section>
      </div>
    </>
  );
}

function Security() {
  const [maintenance, setMaintenance] = useState(false);
  return (
    <>
      <SectionHeader eyebrow="SECURITY & ADMINISTRATION" title="Private by architecture. Governed by design." description="Identity, encryption, policy, auditing, compliance, and platform administration in one control plane." action={<button className="btn btn-primary">Review security posture</button>} />
      <div className="posture-banner"><div className="posture-score">—<span>/100</span></div><div><Tag>NOT ASSESSED</Tag><h2>Security setup has not started</h2><p>Configure identity, encryption, file controls, and auditing before evaluating posture.</p></div><button className="btn btn-secondary">Start configuration</button></div>
      <div className="security-grid">
        {[
          ["Identity & Access", "SSO, LDAP, MFA, RBAC", "Not configured", 0],
          ["Data Protection", "AES-256, TLS 1.3, secrets", "Not configured", 0],
          ["API Security", "Keys, rate limits, IP policy", "Not configured", 0],
          ["File Security", "Malware, validation, watermark", "Not configured", 0],
          ["Compliance", "SOC 2, GDPR, ISO 27001", "Not assessed", 0],
          ["Audit & Sessions", "Devices, sessions, immutable logs", "Not configured", 0],
        ].map(s => <article className="security-card" key={s[0]}><div className="security-icon">◈</div><div><h3>{s[0]}</h3><p>{s[1]}</p></div><span>{s[2]}</span><div className="bar"><i style={{ width: `${s[3]}%` }} /></div><button>Configure →</button></article>)}
      </div>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">RECENT AUDIT EVENTS</span><h2>Immutable activity log</h2></div><button className="text-btn">Open audit log →</button></div><EmptyState compact title="No audit events" description="Administrative actions will appear after audit logging is configured." /></section>
        <section className="panel admin-settings"><div className="panel-head"><div><span className="kicker">SYSTEM ADMINISTRATION</span><h2>Platform controls</h2></div></div>{[["SMTP", "No mail server", false], ["Automated backups", "No schedule", false], ["License", "No license installed", false]].map(x => <div key={x[0]}><span><b>{x[0]}</b><small>{x[1]}</small></span><Tag>Not configured</Tag></div>)}<div><span><b>Maintenance mode</b><small>Restrict access to administrators</small></span><button className={`toggle ${maintenance ? "on" : ""}`} aria-label="Toggle maintenance mode" aria-pressed={maintenance} onClick={() => setMaintenance(!maintenance)}><span /></button></div></section>
      </div>
    </>
  );
}

function Infrastructure() {
  return (
    <>
      <SectionHeader eyebrow="AI INFRASTRUCTURE" title="The private inference fabric." description="Schedule, balance, queue, cache, stream, and observe AI workloads across multi-node GPU clusters." action={<><button className="btn btn-secondary">Open Grafana ↗</button><button className="btn btn-primary">+ Add node</button></>} />
      <div className="cluster-banner"><div><span className="cluster-pulse"><i /><i /><i /></span><div><Tag>NOT CONNECTED</Tag><h2>No compute cluster</h2><p>Add a node or connect an existing Kubernetes environment.</p></div></div><div className="cluster-summary"><span><b>0</b> Nodes</span><span><b>0</b> GPUs</span><span><b>0 GB</b> VRAM</span><span><b>—</b> Uptime</span></div></div>
      <section className="panel"><EmptyState title="Infrastructure services are not running" description="LLM serving, embeddings, scheduling, load balancing, queues, caching, and streaming will appear after a cluster is connected." /></section>
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
      <SectionHeader eyebrow="PLATFORM ROADMAP" title="Every module. Every capability." description={`${platformModules.length} planned modules and ${featureCount} specified capabilities. This catalog describes the product roadmap; it does not claim that every backend is configured.`} />
      <div className="module-toolbar"><div className="search-field"><span>⌕</span><input value={term} onChange={e => setTerm(e.target.value)} aria-label="Search modules and features" placeholder="Find any module or capability…" /></div><Tag tone="green">{filtered.length} modules shown</Tag></div>
      <div className="module-grid">{filtered.map(m => <article className="module-card" key={m.id}><div className="module-number">{m.number}</div><div className="module-title"><h2>{m.name}</h2><Tag>{m.features.length} specified</Tag></div><p>{m.description}</p><div className="feature-cloud">{m.features.map(f => <span key={f}>{f}<i>PRD</i></span>)}</div><button>View roadmap <span>→</span></button></article>)}</div>
    </>
  );
}

function AppContent({
  view,
  navigate,
  documents,
  documentsLoading,
  documentsError,
  reloadDocuments,
}: {
  view: View;
  navigate: (view: View) => void;
  documents: DocumentRecord[];
  documentsLoading: boolean;
  documentsError: string;
  reloadDocuments: () => Promise<void>;
}) {
  switch (view) {
    case "gateway": return <Gateway />;
    case "knowledge": return <Knowledge documents={documents} loading={documentsLoading} loadError={documentsError} reloadDocuments={reloadDocuments} />;
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
    default: return <Overview navigate={navigate} documents={documents} />;
  }
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const reloadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await fetch("/api/documents", { cache: "no-store" });
      const payload = await response.json() as { documents?: DocumentRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load documents.");
      setDocuments(payload.documents ?? []);
    } catch (error) {
      setDocumentsError(error instanceof Error ? error.message : "Unable to load documents.");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { documents?: DocumentRecord[]; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load documents.");
        return payload.documents ?? [];
      })
      .then((records) => {
        if (!cancelled) setDocuments(records);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDocumentsError(error instanceof Error ? error.message : "Unable to load documents.");
      })
      .finally(() => {
        if (!cancelled) setDocumentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
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
          {navItems.slice(0, 10).map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}
          <span className="nav-label">OPERATIONS</span>
          {navItems.slice(10).map(([id, label, icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => navigate(id)}><span className="nav-icon">{icon}</span><span>{label}</span>{id === "modules" && <em className="module-count">21</em>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><span>◈</span><div><b>Private by design</b><small>No AI provider connected</small></div><Dot /></div>
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
            <button className="icon-btn" aria-label="Notifications" onClick={() => announce("No notifications yet")}>♧</button>
            <div className="secure-indicator"><Dot /> Private storage</div>
          </div>
        </header>
        <main className={view === "chat" ? "content content-chat" : "content"}>
          <AppContent view={view} navigate={navigate} documents={documents} documentsLoading={documentsLoading} documentsError={documentsError} reloadDocuments={reloadDocuments} />
        </main>
      </div>
      {notice && <div className="toast"><Dot /> {notice}</div>}
    </div>
  );
}
