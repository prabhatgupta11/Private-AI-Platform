# PrivateAI Platform

A fully local document RAG application. Uploaded documents, extracted text,
embeddings, vector records, retrieved context, model prompts, and answers stay
on your machine.

## Local architecture

```text
Upload (local R2 storage)
  → text extraction with PDF page numbers
  → overlapping page-aware chunks
  → nomic-embed-text in local Ollama
  → embedded SQLite vector store
  → cosine-ranked relevant context
  → qwen2.5:3b in local Ollama
  → grounded answer with [S1] file/page citations
```

Document metadata and vectors persist in the project-local Miniflare SQLite
state. File bytes and extracted-page caches persist in project-local R2 state.
The application does not call an external AI API.

## Requirements

- Node.js `>=22.13.0`
- npm
- [Ollama](https://ollama.com/download)

Node 18 is not supported because vinext uses newer Node filesystem APIs.

## First start

```bash
npm install
npm run local:setup
npm run local:health
npm run dev
```

Open the local URL printed by the development server (normally
`http://localhost:3000`).

1. Open **Knowledge**.
2. Upload a text-based PDF, TXT, Markdown, CSV, HTML, JSON, YAML, or code file.
3. Wait for the real status to change to **Indexed**. If it says **Failed**,
   use **Index** to retry after checking `npm run local:health`.
4. Open **AI Chat** and ask a question whose answer appears in the document.
5. Inspect the `[S1]` citations beneath the answer for the supporting filename
   and page.

Scanned PDFs require OCR and are reported as non-extractable instead of
returning a fabricated answer.

## Local services and data

- Ollama API: `http://127.0.0.1:11434`
- Chat model: `qwen2.5:3b`
- Embedding model: `nomic-embed-text`
- Local application state: `.wrangler/`

Copy `.env.example` to `.env` to select different Ollama models or endpoint.
Changing the embedding model requires re-indexing documents.

## APIs

```bash
# Upload
curl -X POST http://localhost:3000/api/documents -F "files=@document.pdf"

# Index all uploaded documents
curl -X POST -H "Content-Type: application/json" \
  -d '{}' http://localhost:3000/api/index

# Check local AI and vector-store health
curl http://localhost:3000/api/index

# Ask a cited document question
curl -X POST -H "Content-Type: application/json" \
  -d '{"question":"What does Kashika do?"}' http://localhost:3000/api/chat

# List documents
curl http://localhost:3000/api/documents

# Delete a document and all of its vectors
curl -X DELETE "http://localhost:3000/api/documents?id=DOCUMENT_ID"
```

## Validation

```bash
npm run lint
npm test
npm run build
```

## 🚀 Production Deployment to VM

### 📦 Prerequisites

1. **Docker & Docker Compose**: Ensure docker-compose is installed on the host.
2. **Nvidia Drivers & Container Toolkit** (Optional, for GPU acceleration):
   ```bash
   # Install NVIDIA Container Toolkit to pass GPU to docker container
   sudo apt-get install -y nvidia-container-toolkit
   sudo systemctl restart docker
   ```

### 🐳 Quick Start (Docker Compose)

Deploy the entire PrivateAI stack, including the web app, Ollama service, and automatic model downloads, in one command:

```bash
# Clone the repository
git clone <your-repo>
cd <your-repo>

# Start all services
docker compose up -d
```
All persistent files and database state are stored under `./data/.wrangler` on the host machine.

### 🔒 Securing Endpoints with API Key

To prevent unauthorized access to your private documents and chat endpoints:
1. Define an `API_KEY` inside a `.env` file or export it on the host:
   ```env
   API_KEY=your_highly_secure_token_here
   ```
2. Re-create the containers:
   ```bash
   docker compose up -d
   ```
The application will automatically detect this key and require an `Authorization: Bearer <API_KEY>` header for all incoming API queries. The UI will prompt you to input the key upon loading and persist it in your browser's local storage.

### ⚡ GPU Acceleration Configuration

To utilize your VM's Nvidia GPU in Docker Compose:
1. Open [docker-compose.yml](file:///Users/prabhatgupta/code/metawurks/docker-compose.yml).
2. Uncomment the `deploy` block under the `ollama` service:
   ```yaml
   deploy:
     resources:
       reservations:
         devices:
           - driver: nvidia
             count: all
             capabilities: [gpu]
   ```
3. Restart Compose:
   ```bash
   docker compose up -d --force-recreate
   ```

### 🌐 Nginx Reverse Proxy with HTTPS

Configure Nginx on the host VM to proxy traffic to port 3000 and enforce SSL:

1. Create a server block in `/etc/nginx/sites-available/privateai`:
   ```nginx
   server {
       listen 80;
       server_name ai.yourdomain.com;
       client_max_body_size 100M;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
2. Enable and generate certificates:
   ```bash
   sudo ln -s /etc/nginx/sites-available/privateai /etc/nginx/sites-enabled/
   sudo systemctl restart nginx
   sudo certbot --nginx -d ai.yourdomain.com
   ```

