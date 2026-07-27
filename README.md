# PrivateAI Platform

An enterprise AI infrastructure control plane with honest first-run states and
real private document storage. The current working slice supports document
upload, listing, and deletion using Cloudflare R2 for file bytes and D1 for
metadata. AI inference, indexing, search, agents, and workflows are clearly
marked as unconfigured or planned until their backends are connected.

## Requirements

- Node.js `>=22.13.0`
- npm

Node 18 is not supported because vinext uses newer Node filesystem APIs.

## Start locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, select **Knowledge**, and upload one or more
documents. Files may be up to 50 MB each, with a maximum of 20 per request.
Uploaded documents remain available after refresh and can be deleted from the
document table.

Select **AI Chat** to use the built-in platform assistant for setup help and
document-status questions. Conversation history is stored on the current
device. This assistant does not pretend to be a generative model: answering
questions from document contents still requires a local model and indexing
pipeline.

## Document API

Upload:

```bash
curl -X POST http://localhost:3000/api/documents \
  -F "files=@document.pdf"
```

List:

```bash
curl http://localhost:3000/api/documents
```

Delete:

```bash
curl -X DELETE "http://localhost:3000/api/documents?id=DOCUMENT_ID"
```

## Useful commands

```bash
npm run lint
npm test
npm run build
npm run db:generate
```

The hosted site bindings are declared in `.openai/hosting.json`. The document
metadata schema is in `db/schema.ts`, and generated D1 migrations are stored in
`drizzle/`.
