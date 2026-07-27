/** @param {{ name: string, size: number }[]} documents */
function documentSummary(documents) {
  if (documents.length === 0) {
    return "You have not uploaded any documents yet. Open Knowledge, choose Upload, and select a file up to 50 MB.";
  }

  const names = documents.slice(0, 5).map((document) => `“${document.name}”`);
  const remainder = documents.length > names.length ? ` and ${documents.length - names.length} more` : "";
  return `You have ${documents.length} uploaded document${documents.length === 1 ? "" : "s"}: ${names.join(", ")}${remainder}. Files are privately stored, but their contents are not indexed for AI answers yet.`;
}

/** @param {string} input @param {{ name: string, size: number }[]} documents */
export function builtInReply(input, documents) {
  const normalized = input.trim().toLowerCase();

  if (/^(hi|hey|hello|good (morning|afternoon|evening))[\s!.?]*$/.test(normalized)) {
    return "Hello! I’m the built-in PrivateAI platform assistant. I can help you upload and manage documents, explain what is working, and guide you through setup. What would you like to do?";
  }

  if (/(document|file|knowledge).*(show|list|have|uploaded|status)|(?:show|list).*(document|file)/.test(normalized)) {
    return documentSummary(documents);
  }

  if (/(upload|add|ingest).*(document|file)|how.*upload/.test(normalized)) {
    return "Open Knowledge from the left navigation, choose Upload, then select or drag in up to 20 supported files. Each file can be up to 50 MB, and you can delete it later from the document table.";
  }

  if (/(what.*work|capabilit|can you do|help|getting started|start)/.test(normalized)) {
    return "The working features today are private document upload, persistent document listing, filename search, deletion, and this built-in setup assistant. Model inference, document-content indexing, agents, and workflows require additional infrastructure and are clearly marked as planned or unconfigured.";
  }

  if (/(model|llm|inference|chat model)/.test(normalized)) {
    return "No generative model is connected yet. This built-in assistant still handles platform guidance and document status. To answer questions from document contents, connect a local inference model plus an embedding and vector-search pipeline.";
  }

  if (/(delete|remove).*(document|file)/.test(normalized)) {
    return "Open Knowledge, find the document in the table, and choose Delete. The platform removes both the private file object and its metadata record.";
  }

  return "I can help with PrivateAI setup, document uploads, document status, deletion, and currently available features. For open-ended generative answers or questions about document contents, connect a local model and indexing pipeline.";
}

/** @param {{ role: "user" | "assistant", text: string }[]} messages */
export function conversationText(messages) {
  return messages
    .map((message) => `${message.role === "assistant" ? "PrivateAI" : "You"}: ${message.text}`)
    .join("\n\n");
}
