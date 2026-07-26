export type ModuleDefinition = {
  id: string;
  number: string;
  name: string;
  description: string;
  features: string[];
};

export const platformModules: ModuleDefinition[] = [
  {
    id: "identity",
    number: "01",
    name: "Identity & Security",
    description: "Enterprise access, identity federation, and policy enforcement.",
    features: ["SSO", "OAuth", "LDAP", "Active Directory", "JWT", "RBAC", "MFA", "API Keys", "Audit Logs", "Session Management", "Device Management", "IP Restrictions", "Password Policies", "Secrets Management"],
  },
  {
    id: "organizations",
    number: "02",
    name: "Organization Management",
    description: "Multi-tenant structures, ownership, quotas, and commercial controls.",
    features: ["Organizations", "Departments", "Teams", "Projects", "Knowledge Bases", "Storage Quotas", "Billing"],
  },
  {
    id: "knowledge",
    number: "03",
    name: "Knowledge Management",
    description: "Private content ingestion across every enterprise data format.",
    features: ["PDF", "DOCX", "TXT", "CSV", "XLSX", "Markdown", "HTML", "XML", "JSON", "PowerPoint", "Images", "Scanned PDFs", "Audio", "Video", "ZIP", "Code repositories", "Bulk Upload", "Drag & Drop", "Folder Upload", "Versioning", "Tags", "Categories", "Metadata", "Ownership", "Retention Policies", "Soft Delete", "Archive", "Restore"],
  },
  {
    id: "pipeline",
    number: "04",
    name: "Document Processing Pipeline",
    description: "Observable, resilient processing from raw upload to retrieval-ready index.",
    features: ["Upload", "OCR", "Cleaning", "Language Detection", "Deduplication", "Chunking", "Metadata Extraction", "Entity Extraction", "PII Detection", "Embeddings", "Indexing", "Qdrant", "Incremental Updates", "Delta Indexing", "Retry Mechanism", "Dead-letter Queue", "Parallel Processing"],
  },
  {
    id: "search",
    number: "05",
    name: "Search Engine",
    description: "Low-latency hybrid retrieval with granular enterprise filters.",
    features: ["Semantic Search", "Keyword Search", "Hybrid Search", "Vector Search", "Metadata Search", "Boolean Search", "Filters", "Date Filters", "Department Filters", "Author Filters", "Tag Filters", "Source Filters", "Search Suggestions", "Saved Searches", "Recent Searches"],
  },
  {
    id: "chat",
    number: "06",
    name: "AI Chat",
    description: "Grounded, multi-turn private conversations with verifiable sources.",
    features: ["ChatGPT UI", "Streaming", "Markdown", "Tables", "Code", "Charts", "Citations", "Sources", "Conversation Memory", "Thread History", "Export", "Share", "Pin", "Bookmarks", "Multi-turn", "RAG", "Follow-up Questions", "Conversation Rename", "Chat Templates", "Prompt Library", "Response Regeneration"],
  },
  {
    id: "agents",
    number: "07",
    name: "AI Agents",
    description: "Role-specialized agents governed by enterprise permissions.",
    features: ["General Assistant", "Research Agent", "HR Agent", "Finance Agent", "Legal Agent", "Engineering Agent", "SQL Agent", "DevOps Agent", "Support Agent", "Sales Agent", "Code Agent", "Report Agent", "Meeting Agent"],
  },
  {
    id: "workflows",
    number: "08",
    name: "Workflow Automation",
    description: "Human-aware automations for recurring knowledge work.",
    features: ["Document Approval", "Email Drafting", "Ticket Creation", "Meeting Summary", "Daily Reports", "Weekly Reports", "Root Cause Analysis", "Risk Detection", "Compliance Reports"],
  },
  {
    id: "developers",
    number: "09",
    name: "Developer Platform",
    description: "One OpenAI-compatible interface for every private AI workload.",
    features: ["/v1/chat/completions", "/v1/embeddings", "/v1/documents", "/v1/search", "/v1/workflows", "/v1/agents", "/v1/models", "Webhooks", "Python SDK", "Node SDK", "Java SDK", "Go SDK"],
  },
  {
    id: "models",
    number: "10",
    name: "Model Management",
    description: "Install, govern, benchmark, tune, and safely roll back local models.",
    features: ["Install Models", "Switch Models", "Version Control", "Rollback", "Benchmark", "Model Health", "GPU Utilization", "Token Usage", "Context Window", "Quantization", "Fine-tuning Jobs", "LoRA Support", "Qwen", "Llama", "Mistral", "DeepSeek", "Gemma", "Phi", "Custom Models"],
  },
  {
    id: "embeddings",
    number: "11",
    name: "Embedding Management",
    description: "Lifecycle operations for local vector generation and indexes.",
    features: ["Local Embeddings", "Batch Embeddings", "Incremental Embeddings", "Rebuild Index", "Delete Index", "Hybrid Search"],
  },
  {
    id: "vectors",
    number: "12",
    name: "Vector Database",
    description: "Qdrant administration for resilient, scalable retrieval.",
    features: ["Collections", "Namespaces", "Snapshots", "Replication", "Compression", "Backup", "Restore", "Metadata Filtering"],
  },
  {
    id: "prompts",
    number: "13",
    name: "Prompt Management",
    description: "Tested, approved, versioned prompt assets.",
    features: ["Prompt Library", "Version Control", "Testing", "Templates", "Variables", "Prompt Approval"],
  },
  {
    id: "analytics",
    number: "14",
    name: "Analytics Dashboard",
    description: "Adoption, performance, cost, and quality telemetry.",
    features: ["Users", "Queries", "Latency", "GPU", "CPU", "Memory", "Tokens", "Search Success", "Document Growth", "Agent Usage", "Errors", "Top Questions", "Storage"],
  },
  {
    id: "monitoring",
    number: "15",
    name: "Monitoring",
    description: "Full-stack observability for a 99.9% availability target.",
    features: ["Prometheus", "Grafana", "Alerting", "Health Checks", "Audit Logs", "Distributed Tracing", "Log Viewer", "Error Tracking"],
  },
  {
    id: "administration",
    number: "16",
    name: "Administration",
    description: "System-wide operational and lifecycle controls.",
    features: ["System Settings", "SMTP", "Storage", "GPU", "Cluster", "Backup", "Restore", "License", "Updates", "Maintenance Mode"],
  },
  {
    id: "deployment",
    number: "17",
    name: "Deployment",
    description: "Run anywhere, including fully disconnected environments.",
    features: ["Docker", "Docker Compose", "Kubernetes", "Helm", "AWS", "Azure", "GCP", "VMware", "Bare Metal", "Air-gapped Deployment"],
  },
  {
    id: "security",
    number: "18",
    name: "Security",
    description: "Defense-in-depth controls for data, files, APIs, and infrastructure.",
    features: ["AES Encryption", "TLS", "RBAC", "MFA", "Audit Logs", "API Security", "Secrets Manager", "Encryption at Rest", "Encryption in Transit", "Document Watermarking", "Malware Scan", "File Validation"],
  },
  {
    id: "infrastructure",
    number: "19",
    name: "AI Infrastructure",
    description: "The private inference fabric beneath every application.",
    features: ["LLM Server", "Embedding Server", "Inference Scheduler", "GPU Scheduler", "Load Balancer", "Request Queue", "Cache", "Streaming Engine"],
  },
  {
    id: "integrations",
    number: "20",
    name: "Integrations",
    description: "Secure connectors for content, collaboration, databases, and business systems.",
    features: ["Slack", "Microsoft Teams", "GitHub", "GitLab", "Jira", "Confluence", "Notion", "Google Drive", "SharePoint", "OneDrive", "PostgreSQL", "MySQL", "MongoDB", "Oracle", "Snowflake", "SAP", "Salesforce", "ServiceNow"],
  },
  {
    id: "gateway",
    number: "21",
    name: "Private AI Gateway",
    description: "A stable, model-agnostic enterprise AI infrastructure layer.",
    features: ["OpenAI-compatible Routing", "Any Local Model", "Hot Model Switching", "Workload-based Routing", "Policy Enforcement", "Failover", "Rate Limits", "Request Logging", "Local-only Inference", "Zero External Dependency"],
  },
];

export const navItems = [
  ["overview", "Overview", "⌘"],
  ["gateway", "Private AI Gateway", "↗"],
  ["knowledge", "Knowledge", "◇"],
  ["search", "Enterprise Search", "⌕"],
  ["chat", "AI Chat", "✦"],
  ["agents", "AI Agents", "◎"],
  ["workflows", "Workflows", "∞"],
  ["models", "Models & Compute", "▣"],
  ["integrations", "Integrations", "⌁"],
  ["developers", "Developer Platform", "</>"],
  ["analytics", "Analytics", "↟"],
  ["security", "Security", "◈"],
  ["infrastructure", "Infrastructure", "⬡"],
  ["modules", "All modules", "20"],
] as const;

export const modelRows = [
  { name: "Qwen3 32B", role: "Complex reasoning", status: "Serving", gpu: "2 × H100", load: 68, latency: "1.8s", context: "128K" },
  { name: "Qwen3 8B", role: "Fast Q&A", status: "Serving", gpu: "1 × L40S", load: 43, latency: "620ms", context: "32K" },
  { name: "Mistral Small 3.1", role: "Document extraction", status: "Warm", gpu: "1 × A100", load: 12, latency: "910ms", context: "128K" },
  { name: "Qwen3 Embedding", role: "Semantic indexing", status: "Serving", gpu: "1 × L4", load: 51, latency: "84ms", context: "8K" },
];

export const connectors = [
  ["Slack", "Collaboration", "Connected", "2.4M messages"],
  ["GitHub", "Code", "Connected", "186 repositories"],
  ["Jira", "Projects", "Connected", "42 projects"],
  ["Notion", "Knowledge", "Syncing", "12,084 pages"],
  ["SharePoint", "Files", "Connected", "6.8 TB indexed"],
  ["PostgreSQL", "Database", "Connected", "18 schemas"],
  ["Salesforce", "CRM", "Available", "OAuth connector"],
  ["ServiceNow", "Operations", "Available", "Bi-directional"],
];

export const agentRows = [
  ["Research Agent", "Knowledge synthesis", "12.8K", "97.4%", "Active"],
  ["Legal Agent", "Contract review", "4.2K", "98.1%", "Active"],
  ["Engineering Agent", "Code & incident analysis", "8.9K", "95.8%", "Active"],
  ["SQL Agent", "Governed data queries", "6.1K", "99.2%", "Active"],
  ["HR Agent", "Policy & employee support", "3.7K", "96.9%", "Draft"],
];

export const workflowRows = [
  ["Document approval", "Legal workspace", "When contract is uploaded", "Human approval", "Running"],
  ["Incident root cause", "Engineering", "P1 incident created", "DevOps agent", "Running"],
  ["Weekly executive report", "Leadership", "Friday · 16:00", "Report agent", "Running"],
  ["Compliance risk detection", "Global", "New document indexed", "Legal agent", "Paused"],
];
