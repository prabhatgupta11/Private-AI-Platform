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
import { builtInReply, conversationText, shouldUseBuiltInAssistant } from "./chat-assistant";

type View = (typeof navItems)[number][0];

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("privateai-token") : null;
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("privateai-unauthorized"));
    }
  }
  return response;
}

const pipeline = ["Extract text", "Chunk", "Embed locally", "Vector store", "Retrieve context", "Local LLM", "Cited answer"];

type DocumentRecord = {
  id: string;
  name: string;
  objectKey: string;
  size: number;
  contentType: string;
  status: string;
  chunkCount: number;
  indexedAt?: string | null;
  indexError?: string | null;
  createdAt: string;
};

type CitationSource = {
  citation: string;
  documentId: string;
  name: string;
  page: number;
  excerpt: string;
  score: number;
};

type LocalAIStatus = {
  ready: boolean;
  reachable: boolean;
  chatModel: string;
  embedModel: string;
  vectorStore?: { chunks: number; indexedDocuments: number };
};

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  rating?: "good" | "bad";
  sources?: (CitationSource | string)[];
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
  const [localAI, setLocalAI] = useState<LocalAIStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchWithAuth("/api/index", { cache: "no-store" })
      .then((response) => response.json() as Promise<LocalAIStatus>)
      .then((status) => {
        if (!cancelled) setLocalAI(status);
      })
      .catch(() => {
        if (!cancelled) setLocalAI(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const indexedDocuments = documents.filter((document) => document.status === "ready").length;
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="status-pill"><Dot tone={localAI?.ready ? "green" : "amber"} /> {localAI?.ready ? "Local AI is ready · no external provider" : "Local AI setup required"}</div>
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
            <span><Dot /> Local inference with Ollama</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Private AI request flow">
          <div className="flow-title"><span>PRIVATE AI REQUEST FLOW</span><Tag tone={localAI?.ready ? "green" : "amber"}>{localAI?.ready ? "LOCAL & READY" : "SETUP REQUIRED"}</Tag></div>
          <div className="flow-node node-client">
            <span className="node-icon">API</span>
            <span><b>Private document chat</b><small>{documents.length} local document{documents.length === 1 ? "" : "s"}</small></span>
            <span className="flow-rate">Local</span>
          </div>
          <div className="flow-line"><span /></div>
          <div className="flow-node node-gateway">
            <span className="node-icon accent">GW</span>
            <span><b>Local RAG pipeline</b><small>Extract · Embed · Retrieve · Cite</small></span>
            <span className="flow-rate">{indexedDocuments} indexed</span>
          </div>
          <div className="branch-lines"><i /><i /><i /></div>
          <div className="model-nodes">
            <div><b>{localAI?.chatModel || "Qwen setup"}</b><small>Local answers</small><em>{localAI?.ready ? "Ready" : "Off"}</em></div>
            <div><b>{localAI?.embedModel || "Embedding setup"}</b><small>Local embeddings</small><em>{localAI?.ready ? "Ready" : "Off"}</em></div>
            <div><b>SQLite vectors</b><small>Persistent retrieval</small><em>{localAI?.vectorStore?.chunks || 0}</em></div>
          </div>
          <div className="data-boundary">DESIGNED FOR PRIVATE NETWORK DEPLOYMENT</div>
        </div>
      </section>

      <div className="metric-grid">
        <Metric label="Uploaded documents" value={documents.length.toLocaleString()} detail="real records" />
        <Metric label="Storage used" value={formatBytes(storedBytes)} detail="private object storage" />
        <Metric label="Vector chunks" value={(localAI?.vectorStore?.chunks || documents.reduce((total, document) => total + (document.chunkCount || 0), 0)).toLocaleString()} detail="stored locally" />
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
                <span>{indexedDocuments > 0 || (index === 0 && documents.length > 0) ? "✓" : "○"}</span>
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
                <Tag tone={document.status === "ready" ? "green" : "amber"}>{document.status === "ready" ? "Indexed" : "Stored"}</Tag>
                <time>{formatDate(document.indexedAt || document.createdAt)}</time>
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
        action={<button className="btn btn-primary" disabled title="Connect a model before creating a route">+ Create route</button>}
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
  const [indexingId, setIndexingId] = useState("");
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
      const response = await fetchWithAuth("/api/documents", { method: "POST", body });
      const payload = await response.json() as { documents?: DocumentRecord[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      const ids = (payload.documents ?? []).map((document) => document.id);
      if (ids.length) {
        const indexResponse = await fetchWithAuth("/api/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentIds: ids }),
        });
        if (!indexResponse.ok) {
          const indexPayload = await indexResponse.json() as { error?: string };
          setUploadError(`Files uploaded, but indexing is waiting: ${indexPayload.error || "Local AI is unavailable."}`);
        }
      }
      await reloadDocuments();
      setShowUpload(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const indexOne = async (document: DocumentRecord) => {
    setIndexingId(document.id);
    setUploadError("");
    try {
      const response = await fetchWithAuth("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: [document.id] }),
      });
      const payload = await response.json() as { error?: string; failed?: { error: string }[] };
      if (!response.ok || payload.failed?.length) {
        throw new Error(payload.error || payload.failed?.[0]?.error || "Indexing failed.");
      }
      await reloadDocuments();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Indexing failed.");
      await reloadDocuments();
    } finally {
      setIndexingId("");
    }
  };

  const indexedCount = documents.filter((document) => document.status === "ready").length;
  const queuedCount = documents.filter((document) => document.status === "stored" || document.status === "indexing").length;

  const deleteDocument = async (document: DocumentRecord) => {
    setDeletingId(document.id);
    setUploadError("");
    try {
      const response = await fetchWithAuth(`/api/documents?id=${encodeURIComponent(document.id)}`, { method: "DELETE" });
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
      <SectionHeader eyebrow="KNOWLEDGE MANAGEMENT" title="Your enterprise memory, governed." description="Start with a real document. File bytes are stored privately and metadata persists across sessions." action={<><button className="btn btn-secondary" disabled title="External connectors are not configured">Connect source</button><button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>↑ Upload</button></>} />
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
            accept=".pdf,.txt,.csv,.md,.html,.xml,.json,.py,.js,.ts,.tsx,.jsx,.java,.go,.rs,.sql,.yaml,.yml"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
            }}
          />
          <span className="upload-icon">↑</span>
          <div><b>Drop files here</b><small>Text-based PDF, TXT, Markdown, CSV, HTML, JSON, YAML, and code · up to 50 MB each</small></div>
          <button className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : "Choose files"}</button>
        </div>
      )}
      {(uploadError || loadError) && <div className="inline-error" role="alert">{uploadError || loadError}</div>}
      <div className="metric-grid">
        <Metric label="Documents" value={documents.length.toLocaleString()} detail="persisted records" />
        <Metric label="Storage used" value={formatBytes(totalBytes)} detail="private object storage" />
        <Metric label="Processing queue" value={queuedCount.toLocaleString()} detail="local indexing" />
        <Metric label="Indexed" value={indexedCount.toLocaleString()} detail={`${documents.reduce((total, document) => total + (document.chunkCount || 0), 0)} vector chunks`} />
      </div>
      <section className="panel">
        <div className="toolbar">
          <div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search knowledge" placeholder="Search uploaded documents…" /></div>
          <button className="filter-btn" disabled>All sources</button><button className="filter-btn" disabled>All teams</button><button className="filter-btn" disabled>Status</button>
        </div>
        <div className="data-table knowledge-table">
          <div className="table-row table-head"><span>Name</span><span>Owner</span><span>Version</span><span>Status</span><span>Updated</span><span /></div>
          {filteredDocuments.map((document) => <div className="table-row" key={document.id}><span className="doc-name"><i>{document.name.split(".").pop()?.slice(0, 3).toUpperCase() || "DOC"}</i><b>{document.name}<small>{formatBytes(document.size)} · {document.chunkCount || 0} chunks{document.indexError ? ` · ${document.indexError}` : ""}</small></b></span><span>Local upload</span><span>v1</span><span><Tag tone={document.status === "ready" ? "green" : document.status === "index_failed" ? "red" : "amber"}>{document.status === "ready" ? "Indexed" : document.status === "index_failed" ? "Failed" : document.status === "indexing" ? "Indexing" : "Stored"}</Tag></span><time>{formatDate(document.indexedAt || document.createdAt)}</time><span className="row-actions">{document.status !== "ready" && <button aria-label={`Index ${document.name}`} disabled={indexingId === document.id} onClick={() => void indexOne(document)}>{indexingId === document.id ? "…" : "Index"}</button>}<button aria-label={`Delete ${document.name}`} disabled={deletingId === document.id} onClick={() => void deleteDocument(document)}>{deletingId === document.id ? "…" : "Delete"}</button></span></div>)}
        </div>
        {loading ? <EmptyState compact title="Loading documents" description="Reading your private document library." /> : filteredDocuments.length === 0 && <EmptyState title={query ? "No matching documents" : "No documents uploaded"} description={query ? "Try a different filename." : "Choose a file above to create your first real record."} />}
        <div className="table-footer"><span>Showing {filteredDocuments.length} of {documents.length} documents</span></div>
      </section>
    </>
  );
}

function SearchView({ documents, navigate }: { documents: DocumentRecord[]; navigate: (view: View) => void }) {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [saved, setSaved] = useState(false);
  const results = useMemo(() => {
    const term = submittedQuery.trim().toLowerCase();
    return term ? documents.filter((document) => document.name.toLowerCase().includes(term)) : [];
  }, [documents, submittedQuery]);
  const search = () => setSubmittedQuery(query.trim());
  return (
    <>
      <SectionHeader eyebrow="DOCUMENT SEARCH" title="Find your uploaded files." description="Search filenames here, or use AI Chat for local semantic retrieval across indexed document content." />
      <div className="search-hero">
        <div className="main-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") search(); }} aria-label="Search uploaded document names" placeholder="Search document names…" /><kbd>⌘ K</kbd><button onClick={search}>Search</button></div>
        <div className="search-options"><Tag tone="green">Filename search live</Tag><span>Scope: Uploaded documents</span><span>Sort: Newest first</span><button disabled={!submittedQuery} onClick={() => setSaved(!saved)}>{saved ? "★ Saved" : "☆ Save search"}</button></div>
      </div>
      <div className="search-layout">
        <aside className="filter-panel">
          <span className="kicker">FILTERS</span>
          {["Date range", "Department", "Source", "Author", "Tags", "File type"].map(f => <div className="filter-group" key={f}><b>{f}<span>⌄</span></b><small>No indexed values</small></div>)}
        </aside>
        <section className="results">
          <div className="results-head"><span><b>{results.length} result{results.length === 1 ? "" : "s"}</b></span><span>{submittedQuery ? `Filename match for “${submittedQuery}”` : "Enter a filename to search"}</span></div>
          {results.map((document) => <article className="result-card" key={document.id}><span className="file-icon">{document.name.split(".").pop()?.slice(0, 3).toUpperCase() || "DOC"}</span><div><h3>{document.name}</h3><p>{formatBytes(document.size)} · {document.contentType}</p><small>Uploaded {formatDate(document.createdAt)}</small></div><button className="text-btn" onClick={() => navigate("knowledge")}>Open in Knowledge →</button></article>)}
          {results.length === 0 && <EmptyState title={submittedQuery ? "No matching filenames" : "Search your uploaded documents"} description={submittedQuery ? "Try a different filename or upload the document first." : documents.length ? `There ${documents.length === 1 ? "is" : "are"} ${documents.length} uploaded document${documents.length === 1 ? "" : "s"} available to search.` : "Upload a document in Knowledge to create your first searchable filename."} action={!documents.length ? <button className="text-btn" onClick={() => navigate("knowledge")}>Upload document →</button> : undefined} />}
        </section>
      </div>
    </>
  );
}

function ChatView({ documents, navigate, announce }: { documents: DocumentRecord[]; navigate: (view: View) => void; announce: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [replying, setReplying] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      try {
        const stored = window.localStorage.getItem("privateai-chat");
        if (!cancelled && stored) setMessages(JSON.parse(stored) as AssistantMessage[]);
      } catch {
        // A blocked storage API should not prevent chat from working.
      } finally {
        if (!cancelled) setHistoryReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!historyReady) return;
    window.localStorage.setItem("privateai-chat", JSON.stringify(messages));
  }, [historyReady, messages]);

  const submit = async (text = message) => {
    const trimmed = text.trim();
    if (!trimmed || replying) return;

    const userMessage: AssistantMessage = { id: crypto.randomUUID(), role: "user", text: trimmed };
    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setReplying(true);

    if (shouldUseBuiltInAssistant(trimmed)) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        text: builtInReply(trimmed, documents),
        sources: [],
      }]);
      setReplying(false);
      return;
    }

    const assistantMessageId = crypto.randomUUID();
    setMessages((current) => [...current, {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      sources: [],
    }]);

    try {
      const response = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({ question: trimmed, stream: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Unable to search your documents.");
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body reader.");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith("data: ")) {
              const dataText = line.slice(6).trim();
              if (dataText === "{}") continue;
              try {
                const data = JSON.parse(dataText);
                if (Array.isArray(data)) {
                  setMessages((current) => current.map((m) => m.id === assistantMessageId ? {
                    ...m,
                    sources: data,
                  } : m));
                } else if (data.content !== undefined) {
                  setMessages((current) => current.map((m) => m.id === assistantMessageId ? {
                    ...m,
                    text: m.text + data.content,
                  } : m));
                } else if (data.error !== undefined) {
                  throw new Error(data.error);
                }
              } catch {}
            }
          }
        }
      } else {
        const payload = await response.json() as { answer?: string; sources?: CitationSource[] };
        setMessages((current) => current.map((m) => m.id === assistantMessageId ? {
          ...m,
          text: payload.answer || "I could not find an answer in the uploaded documents.",
          sources: payload.sources ?? [],
        } : m));
      }
    } catch (error) {
      setMessages((current) => current.map((m) => m.id === assistantMessageId ? {
        ...m,
        text: error instanceof Error ? `I could not search the documents: ${error.message}` : "I could not search the documents.",
      } : m));
    } finally {
      setReplying(false);
    }
  };

  const newConversation = () => {
    setMessages([]);
    setMessage("");
    setFavorite(false);
    announce("New conversation started");
  };

  const exportConversation = () => {
    if (!messages.length) return;
    const blob = new Blob([conversationText(messages)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "privateai-conversation.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("Conversation exported");
  };

  const shareConversation = async () => {
    if (!messages.length) return;
    const text = conversationText(messages);
    if (navigator.share) {
      try {
        await navigator.share({ title: "PrivateAI conversation", text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const copied = await copyText(text);
    announce(copied ? "Conversation copied for sharing" : "Unable to share conversation");
  };

  const rate = (id: string, rating: "good" | "bad") => {
    setMessages((current) => current.map((item) => item.id === id ? { ...item, rating: item.rating === rating ? undefined : rating } : item));
    announce(rating === "good" ? "Marked as helpful" : "Feedback recorded");
  };

  const regenerate = async (index: number) => {
    const prompt = [...messages].slice(0, index).reverse().find((item) => item.role === "user");
    if (!prompt || replying) return;
    setReplying(true);

    setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      text: "",
      sources: [],
      rating: undefined,
    } : item));

    try {
      const response = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream"
        },
        body: JSON.stringify({ question: prompt.text, stream: true }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error || "Unable to search your documents.");
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body reader.");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith("data: ")) {
              const dataText = line.slice(6).trim();
              if (dataText === "{}") continue;
              try {
                const data = JSON.parse(dataText);
                if (Array.isArray(data)) {
                  setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? {
                    ...item,
                    sources: data,
                  } : item));
                } else if (data.content !== undefined) {
                  setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? {
                    ...item,
                    text: item.text + data.content,
                  } : item));
                } else if (data.error !== undefined) {
                  throw new Error(data.error);
                }
              } catch {}
            }
          }
        }
        announce("Response regenerated");
      } else {
        const payload = await response.json() as { answer?: string; sources?: CitationSource[] };
        setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? {
          ...item,
          text: payload.answer || "I could not find an answer in the uploaded documents.",
          sources: payload.sources ?? [],
        } : item));
        announce("Response regenerated");
      }
    } catch (error) {
      setMessages((current) => current.map((item, itemIndex) => itemIndex === index ? {
        ...item,
        text: error instanceof Error ? `I could not search the documents: ${error.message}` : "I could not search the documents.",
      } : item));
    } finally {
      setReplying(false);
    }
  };
  return (
    <div className="chat-shell">
      <aside className="threads-panel">
        <button className="btn btn-primary new-chat" onClick={newConversation}>+ New conversation</button>
        <span className="kicker">TODAY</span>
        {messages.length ? <div className="thread active"><span>●</span><b>{messages.find((item) => item.role === "user")?.text || "Platform assistant"}</b><small>{Math.ceil(messages.length / 2)}</small></div> : <EmptyState compact title="No conversations" description="Send a message to begin." />}
      </aside>
      <section className="chat-main">
        <div className="chat-head"><div><h2>Private document assistant</h2><span><Dot /> Document Q&amp;A · {documents.length} uploaded document{documents.length === 1 ? "" : "s"}</span></div><div><button aria-label={favorite ? "Remove favorite" : "Favorite conversation"} onClick={() => setFavorite(!favorite)}>{favorite ? "★" : "☆"}</button><button disabled={!messages.length} onClick={() => void shareConversation()}>Share</button><button disabled={!messages.length} onClick={exportConversation}>Export</button><button disabled={!messages.length} onClick={newConversation}>Clear</button></div></div>
        <div className="messages">
          {messages.length === 0 && <div className="chat-welcome"><EmptyState title="Ask your private documents" description="I’ll extract relevant passages from uploaded PDFs and text files and show exactly which files support the answer." /><div className="prompt-chips">{["Summarize my uploaded documents", "Show my uploaded documents", "How do I upload a document?"].map((prompt) => <button key={prompt} disabled={replying} onClick={() => void submit(prompt)}>{prompt}</button>)}</div></div>}
          {messages.map((item, index) => <div className={`message ${item.role}`} key={item.id}><div className="avatar">{item.role === "assistant" ? "PA" : "PG"}</div><div><span className="message-author">{item.role === "assistant" ? "PrivateAI assistant" : "You"}</span><p>{item.text}</p>{item.sources && item.sources.length > 0 && <div className="message-sources"><b>Sources</b>{item.sources.map((source) => typeof source === "string" ? <span key={source}>{source}</span> : <span key={`${source.citation}:${source.documentId}:${source.page}`} title={source.excerpt}>{source.citation} {source.name} · page {source.page}</span>)}</div>}{item.role === "assistant" && <div className="message-tools"><button onClick={async () => announce(await copyText(item.text) ? "Response copied" : "Unable to copy response")}>Copy</button><button className={item.rating === "good" ? "active" : ""} onClick={() => rate(item.id, "good")}>Good</button><button className={item.rating === "bad" ? "active" : ""} onClick={() => rate(item.id, "bad")}>Bad</button><button disabled={replying} onClick={() => void regenerate(index)}>Regenerate</button></div>}</div></div>)}
          {replying && <div className="message assistant pending"><div className="avatar">PA</div><div><span className="message-author">PrivateAI assistant</span><p><Dot /> Extracting, embedding, retrieving, and asking your local model…</p></div></div>}
        </div>
        <div className="composer"><textarea aria-label="Message PrivateAI" placeholder="Ask a question about your uploaded documents…" disabled={replying} value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); } }} /><div><button className="composer-link" onClick={() => navigate("knowledge")}>＋ Upload document</button><span>Knowledge: {documents.length} file{documents.length === 1 ? "" : "s"}</span><button aria-label="Send message" disabled={!message.trim() || replying} onClick={() => void submit()}>↑</button></div></div>
        <small className="chat-disclaimer">Documents, embeddings, retrieval, and generation stay on this machine. Answers include file and page citations. Scanned PDFs require OCR.</small>
      </section>
    </div>
  );
}

function Agents() {
  return (
    <>
      <SectionHeader eyebrow="AI AGENTS" title="Deploy specialists, not shadow AI." description="Purpose-built agents inherit user permissions, approved tools, knowledge scopes, and complete auditability." action={<button className="btn btn-primary" disabled title="Install a model before building agents">+ Build agent</button>} />
      <div className="agent-hero panel">
        <div><Tag tone="blue">LANGGRAPH ORCHESTRATION</Tag><h2>Agents that reason inside your boundaries.</h2><p>Every tool call, retrieval, model decision, and human approval is observable and governed by policy.</p><div className="hero-actions"><button className="btn btn-primary" disabled>Open agent studio</button><button className="btn btn-secondary" disabled>Browse templates</button></div></div>
        <div className="agent-flow"><div className="agent-core">AGENT<small>Plan · Reason · Act</small></div><span className="orbit one">Knowledge</span><span className="orbit two">Tools</span><span className="orbit three">Approvals</span><span className="orbit four">Memory</span></div>
      </div>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">DEPLOYED AGENTS</span><h2>Agent fleet</h2></div><div className="search-field compact"><span>⌕</span><input placeholder="Find agent…" /></div></div>
        <div className="data-table agent-table"><div className="table-row table-head"><span>Agent</span><span>Purpose</span><span>Runs / 30d</span><span>Success</span><span>Status</span><span /></div>{agentRows.map((a) => <div className="table-row" key={a[0]}><span className="doc-name"><i>AI</i><b>{a[0]}<small>Qwen3 32B · RAG enabled</small></b></span><span>{a[1]}</span><span>{a[2]}</span><span>{a[3]}</span><span><Tag tone={a[4] === "Active" ? "green" : "amber"}>{a[4]}</Tag></span><button disabled>•••</button></div>)}</div>
        <EmptyState title="No agents deployed" description="Install a local model and create an agent when you are ready." />
      </section>
    </>
  );
}

function Workflows() {
  return (
    <>
      <SectionHeader eyebrow="WORKFLOW AUTOMATION" title="Turn intelligence into governed action." description="Compose AI, enterprise systems, and human approvals into reliable private workflows." action={<button className="btn btn-primary" disabled title="Workflow services are not configured">+ New workflow</button>} />
      <div className="metric-grid"><Metric label="Workflow runs" value="0" detail="no runs" /><Metric label="Hours saved" value="0" detail="not measured" /><Metric label="Success rate" value="—" detail="no completed runs" /><Metric label="Awaiting approval" value="0" detail="no human tasks" /></div>
      <section className="panel workflow-builder">
        <div className="panel-head"><div><span className="kicker">VISUAL ORCHESTRATION</span><h2>Workflow canvas</h2></div></div>
        <EmptyState title="No workflow selected" description="Create your first workflow to begin adding triggers, AI steps, and approvals." />
      </section>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">AUTOMATIONS</span><h2>Production workflows</h2></div><button className="filter-btn" disabled>All status</button></div>
        <div className="data-table workflow-table"><div className="table-row table-head"><span>Workflow</span><span>Scope</span><span>Trigger</span><span>Decision</span><span>Status</span><span /></div>{workflowRows.map(w => <div className="table-row" key={w[0]}><span><b>{w[0]}</b></span><span>{w[1]}</span><span>{w[2]}</span><span>{w[3]}</span><span><Tag tone={w[4] === "Running" ? "green" : "amber"}>{w[4]}</Tag></span><button disabled>•••</button></div>)}</div>
        <EmptyState title="No workflows created" description="Published automations will appear here." />
      </section>
    </>
  );
}

function Models() {
  const [active, setActive] = useState("");
  return (
    <>
      <SectionHeader eyebrow="MODELS & COMPUTE" title="Your models. Your GPUs. Your control." description="Install, benchmark, tune, route, version, and roll back every locally served model." action={<><button className="btn btn-secondary" disabled>Run benchmark</button><button className="btn btn-primary" disabled>+ Install model</button></>} />
      <div className="metric-grid"><Metric label="Models installed" value="0" detail="none installed" /><Metric label="GPU utilization" value="—" detail="no cluster connected" /><Metric label="Tokens / second" value="0" detail="no inference" /><Metric label="Fine-tuning jobs" value="0" detail="none running" /></div>
      <section className="panel">
        <div className="panel-head"><div><span className="kicker">MODEL REGISTRY</span><h2>Serving models</h2></div><div className="search-field compact"><span>⌕</span><input placeholder="Search models…" /></div></div>
        <div className="model-list">
          {modelRows.map(m => <article className={`model-row ${active === m.name ? "selected" : ""}`} key={m.name} onClick={() => setActive(m.name)}><div className="model-mark">{m.name.slice(0, 1)}</div><div className="model-info"><h3>{m.name}</h3><p>{m.role}</p><div><Tag tone={m.status === "Serving" ? "green" : "amber"}><Dot /> {m.status}</Tag><span>{m.gpu}</span><span>{m.context} context</span></div></div><div className="model-load"><span><b>{m.load}%</b> GPU</span><div className="bar"><i style={{ width: `${m.load}%` }} /></div></div><div className="model-latency"><b>{m.latency}</b><span>P95 latency</span></div><button aria-label={`More options for ${m.name}`} disabled>•••</button></article>)}
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
      <SectionHeader eyebrow="INTEGRATIONS" title="Connect knowledge where it already lives." description="Secure, incremental connectors preserve source permissions and keep private indexes fresh." action={<button className="btn btn-primary" disabled title="Connector backends are not configured">+ Add integration</button>} />
      <div className="integration-stats"><span>0 connected</span><span>0 syncing</span><span>No synchronization has run</span><button disabled>Sync all</button></div>
      <div className="connector-grid">{connectors.map((c, i) => <article className="connector-card" key={c[0]}><div className={`connector-logo logo-${i}`}>{c[0].slice(0, 2).toUpperCase()}</div><div><h3>{c[0]}</h3><p>{c[1]}</p></div><Tag tone={c[2] === "Connected" ? "green" : c[2] === "Syncing" ? "blue" : "neutral"}>{c[2]}</Tag><div className="connector-foot"><span>{c[3]}</span><button disabled title="Connector backend not configured">Connect</button></div></article>)}</div>
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
      <SectionHeader eyebrow="DEVELOPER PLATFORM" title="Use the live local RAG APIs." description="Document upload, local indexing, health checks, cited chat, listing, and deletion are available now. Agents and workflows remain on the roadmap." action={<button className="btn btn-secondary" disabled>API reference coming soon</button>} />
      <div className="dev-layout">
        <section className="panel endpoint-list"><span className="kicker">API ENDPOINTS</span>{["/api/documents", "/api/index", "/api/chat", "/v1/workflows", "/v1/agents"].map((e, i) => <button className={i === 0 ? "active" : ""} disabled={i > 2} onClick={() => setLang("curl")} key={e}><Tag tone={i <= 2 ? "green" : "neutral"}>{i <= 2 ? "LIVE" : "PLANNED"}</Tag><code>{e}</code><span>›</span></button>)}</section>
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
      <SectionHeader eyebrow="ANALYTICS & OBSERVABILITY" title="Know exactly how private AI performs." description="One view across adoption, answer quality, inference, retrieval, infrastructure, agents, and risk." action={<button className="filter-btn" disabled>Last 30 days</button>} />
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
      <SectionHeader eyebrow="SECURITY & ADMINISTRATION" title="Private by architecture. Governed by design." description="Identity, encryption, policy, auditing, compliance, and platform administration in one control plane." action={<button className="btn btn-primary" disabled>Review security posture</button>} />
      <div className="posture-banner"><div className="posture-score">—<span>/100</span></div><div><Tag>NOT ASSESSED</Tag><h2>Security setup has not started</h2><p>Configure identity, encryption, file controls, and auditing before evaluating posture.</p></div><button className="btn btn-secondary" disabled>Start configuration</button></div>
      <div className="security-grid">
        {[
          ["Identity & Access", "SSO, LDAP, MFA, RBAC", "Not configured", 0],
          ["Data Protection", "AES-256, TLS 1.3, secrets", "Not configured", 0],
          ["API Security", "Keys, rate limits, IP policy", "Not configured", 0],
          ["File Security", "Malware, validation, watermark", "Not configured", 0],
          ["Compliance", "SOC 2, GDPR, ISO 27001", "Not assessed", 0],
          ["Audit & Sessions", "Devices, sessions, immutable logs", "Not configured", 0],
        ].map(s => <article className="security-card" key={s[0]}><div className="security-icon">◈</div><div><h3>{s[0]}</h3><p>{s[1]}</p></div><span>{s[2]}</span><div className="bar"><i style={{ width: `${s[3]}%` }} /></div><button disabled>Configure →</button></article>)}
      </div>
      <div className="two-col">
        <section className="panel"><div className="panel-head"><div><span className="kicker">RECENT AUDIT EVENTS</span><h2>Immutable activity log</h2></div><button className="text-btn" disabled>Open audit log →</button></div><EmptyState compact title="No audit events" description="Administrative actions will appear after audit logging is configured." /></section>
        <section className="panel admin-settings"><div className="panel-head"><div><span className="kicker">SYSTEM ADMINISTRATION</span><h2>Platform controls</h2></div></div>{([["SMTP", "No mail server", false], ["Automated backups", "No schedule", false], ["License", "No license installed", false]] as const).map(x => <div key={x[0]}><span><b>{x[0]}</b><small>{x[1]}</small></span><Tag>Not configured</Tag></div>)}<div><span><b>Maintenance mode</b><small>Restrict access to administrators</small></span><button className={`toggle ${maintenance ? "on" : ""}`} aria-label="Toggle maintenance mode" aria-pressed={maintenance} onClick={() => setMaintenance(!maintenance)}><span /></button></div></section>
      </div>
    </>
  );
}

function Infrastructure() {
  return (
    <>
      <SectionHeader eyebrow="AI INFRASTRUCTURE" title="The private inference fabric." description="Schedule, balance, queue, cache, stream, and observe AI workloads across multi-node GPU clusters." action={<><button className="btn btn-secondary" disabled>Open Grafana</button><button className="btn btn-primary" disabled>+ Add node</button></>} />
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
      <div className="module-toolbar"><div className="search-field"><span>⌕</span><input value={term} onChange={e => setTerm(e.target.value)} aria-label="Search modules and features" placeholder="Find any module or capability…" /></div><Tag tone="green">{filtered.length} module{filtered.length === 1 ? "" : "s"} shown</Tag></div>
      <div className="module-grid">{filtered.map(m => <article className="module-card" key={m.id}><div className="module-number">{m.number}</div><div className="module-title"><h2>{m.name}</h2><Tag>{m.features.length} specified</Tag></div><p>{m.description}</p><div className="feature-cloud">{m.features.map(f => <span key={f}>{f}<i>PRD</i></span>)}</div><button disabled>Roadmap item <span>→</span></button></article>)}</div>
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
  announce,
}: {
  view: View;
  navigate: (view: View) => void;
  documents: DocumentRecord[];
  documentsLoading: boolean;
  documentsError: string;
  reloadDocuments: () => Promise<void>;
  announce: (message: string) => void;
}) {
  switch (view) {
    case "gateway": return <Gateway />;
    case "knowledge": return <Knowledge documents={documents} loading={documentsLoading} loadError={documentsError} reloadDocuments={reloadDocuments} />;
    case "search": return <SearchView documents={documents} navigate={navigate} />;
    case "chat": return <ChatView documents={documents} navigate={navigate} announce={announce} />;
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [inputKey, setInputKey] = useState("");

  useEffect(() => {
    const handleUnauthorized = () => {
      setShowAuthModal(true);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("privateai-unauthorized", handleUnauthorized);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("privateai-unauthorized", handleUnauthorized);
      }
    };
  }, []);
  const reloadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await fetchWithAuth("/api/documents", { cache: "no-store" });
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
    fetchWithAuth("/api/documents", { cache: "no-store" })
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
        <div className="environment">
          <span><Dot /> Production</span>
          {typeof window !== "undefined" && window.localStorage.getItem("privateai-token") && (
            <button aria-label="Clear API Key" onClick={() => {
              window.localStorage.removeItem("privateai-token");
              window.location.reload();
            }} title="Clear API Key" style={{ border: 0, background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: "11px" }}>Reset 🔑</button>
          )}
        </div>
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
          <AppContent view={view} navigate={navigate} documents={documents} documentsLoading={documentsLoading} documentsError={documentsError} reloadDocuments={reloadDocuments} announce={announce} />
        </main>
      </div>
      {notice && <div className="toast"><Dot /> {notice}</div>}

      {showAuthModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <span className="auth-icon">🔑</span>
            <h3>Authentication Required</h3>
            <p>This private deployment requires an API Access Token to communicate with the compute node.</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (inputKey.trim()) {
                window.localStorage.setItem("privateai-token", inputKey.trim());
                window.location.reload();
              }
            }}>
              <input
                type="password"
                placeholder="Enter Access Token..."
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                autoFocus
                required
              />
              <div className="auth-actions">
                <button type="submit" className="btn btn-primary">Connect Node</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
