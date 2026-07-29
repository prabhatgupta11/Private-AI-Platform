import { log } from "../logger";

export interface CitationSource {
  citation: string;
  documentId: string;
  name: string;
  page: number;
  excerpt: string;
  score: number;
}

export interface LLMProvider {
  embed(texts: string[]): Promise<number[][]>;
  health(): Promise<{ ready: boolean; reachable: boolean; missingModels: string[]; chatModel: string; embedModel: string; baseUrl: string }>;
  answer(question: string, matches: any[]): Promise<{ answer: string; sources: CitationSource[] }>;
  streamAnswer(question: string, matches: any[]): AsyncGenerator<{ type: string; content?: string; sources?: CitationSource[] }>;
}

// Ollama Provider
class OllamaLLMProvider implements LLMProvider {
  private getConf() {
    const baseUrl = (process.env.OLLAMA_BASE_URL || process.env.LLM_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
    const chatModel = process.env.OLLAMA_CHAT_MODEL || process.env.LLM_MODEL || "qwen2.5:3b";
    const embedModel = process.env.OLLAMA_EMBED_MODEL || process.env.EMBED_MODEL || "nomic-embed-text";
    return { baseUrl, chatModel, embedModel };
  }

  private async ollamaRequest(path: string, body?: unknown) {
    const { baseUrl } = this.getConf();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120_000),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Ollama returned HTTP ${response.status}.`);
      }
      return payload;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown local service error";
      if (/fetch failed|ECONNREFUSED|connect/i.test(detail)) {
        throw new Error("The local Ollama service is not reachable. Start Ollama, then run `npm run local:setup`.");
      }
      throw error instanceof Error ? error : new Error(detail);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { embedModel } = this.getConf();
    const embeddings: number[][] = [];
    const batchSize = 24;

    for (let offset = 0; offset < texts.length; offset += batchSize) {
      const input = texts.slice(offset, offset + batchSize);
      const payload = await this.ollamaRequest("/api/embed", { model: embedModel, input }) as {
        embeddings?: number[][];
      };
      if (!payload.embeddings || payload.embeddings.length !== input.length) {
        throw new Error(`The local embedding model ${embedModel} returned an invalid response.`);
      }
      embeddings.push(...payload.embeddings);
    }
    return embeddings;
  }

  async health() {
    const { chatModel, embedModel, baseUrl } = this.getConf();
    try {
      const payload = await this.ollamaRequest("/api/tags") as { models?: { name: string; model?: string }[] };
      const installed = (payload.models ?? []).flatMap((model) => [model.name, model.model].filter(Boolean));
      const hasModel = (wanted: string) => installed.some((name) =>
        name === wanted || name === `${wanted}:latest` || name?.startsWith(`${wanted}:`));
      return {
        ready: hasModel(chatModel) && hasModel(embedModel),
        reachable: true,
        baseUrl,
        chatModel,
        embedModel,
        missingModels: [chatModel, embedModel].filter((model) => !hasModel(model)),
      };
    } catch (error) {
      return {
        ready: false,
        reachable: false,
        baseUrl,
        chatModel,
        embedModel,
        missingModels: [chatModel, embedModel],
        error: error instanceof Error ? error.message : "Ollama is unavailable.",
      };
    }
  }

  async answer(question: string, matches: any[]) {
    const { chatModel } = this.getConf();
    const contextText = matches
      .map((match) => `${match.citation} File: ${match.documentName}; page: ${match.page}\n${match.text}`)
      .join("\n\n");
    const groundedPrompt = `Question:\n${question}\n\nRelevant private context:\n${contextText}`;

    const payload = await this.ollamaRequest("/api/chat", {
      model: chatModel,
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        {
          role: "system",
          content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
        },
        { role: "user", content: groundedPrompt },
      ],
    }) as { message?: { content?: string } };

    const rawAnswer = payload.message?.content?.trim();
    if (!rawAnswer) throw new Error(`The local model ${chatModel} returned an empty answer.`);

    const unique = [];
    const seen = new Set();
    for (const match of matches) {
      const key = `${match.documentName}:${match.page}`;
      if (!seen.has(key)) {
        unique.push(`${match.citation} ${match.documentName}, page ${match.page}`);
        seen.add(key);
      }
    }
    const finalAnswer = /\[S\d+\]/.test(rawAnswer) ? rawAnswer : `${rawAnswer}\n\nSources: ${unique.join("; ")}`;

    return {
      answer: finalAnswer,
      sources: matches.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        name: match.documentName,
        page: match.page,
        excerpt: match.text.slice(0, 240),
        score: Number(match.score.toFixed(4)),
      })),
    };
  }

  async *streamAnswer(question: string, matches: any[]) {
    yield {
      type: "sources",
      sources: matches.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        name: match.documentName,
        page: match.page,
        excerpt: match.text.slice(0, 240),
        score: Number(match.score.toFixed(4)),
      }))
    };

    const { chatModel, baseUrl } = this.getConf();
    const contextText = matches
      .map((match) => `${match.citation} File: ${match.documentName}; page: ${match.page}\n${match.text}`)
      .join("\n\n");
    const groundedPrompt = `Question:\n${question}\n\nRelevant private context:\n${contextText}`;

    log.info(`Requesting streaming chat completion from Ollama: ${chatModel}`);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chatModel,
        stream: true,
        options: { temperature: 0.1 },
        messages: [
          {
            role: "system",
            content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
          },
          { role: "user", content: groundedPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama stream request failed: HTTP ${response.status} - ${text}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Ollama response has no readable stream.");

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as { message?: { content?: string } };
            const chunk = parsed.message?.content || "";
            if (chunk) yield { type: "text", content: chunk };
          } catch {}
        }
      }
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer) as { message?: { content?: string } };
          const chunk = parsed.message?.content || "";
          if (chunk) yield { type: "text", content: chunk };
        } catch {}
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// vLLM Provider (OpenAI Compatible)
class VllmLLMProvider implements LLMProvider {
  private getConf() {
    const baseUrl = (process.env.LLM_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    const chatModel = process.env.LLM_MODEL || "qwen2.5:3b";
    const embedModel = process.env.EMBED_MODEL || "nomic-embed-text";
    return { baseUrl, chatModel, embedModel };
  }

  private async vllmFetch(path: string, body: unknown) {
    const { baseUrl } = this.getConf();
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`vLLM API returned HTTP ${response.status}: ${text}`);
    }
    return response;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { embedModel } = this.getConf();
    const response = await this.vllmFetch("/v1/embeddings", {
      model: embedModel,
      input: texts,
    });
    const payload = await response.json() as { data?: { embedding: number[] }[] };
    if (!payload.data || payload.data.length !== texts.length) {
      throw new Error("vLLM embeddings endpoint returned invalid size payload.");
    }
    return payload.data.map((item) => item.embedding);
  }

  async health() {
    const { chatModel, embedModel, baseUrl } = this.getConf();
    try {
      const response = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { data?: { id: string }[] };
      const ids = (payload.data ?? []).map((m) => m.id);
      const hasModel = (wanted: string) => ids.some((name) => name === wanted || name.startsWith(`${wanted}:`));
      
      return {
        ready: true,
        reachable: true,
        baseUrl,
        chatModel,
        embedModel,
        missingModels: [],
      };
    } catch (error) {
      return {
        ready: false,
        reachable: false,
        baseUrl,
        chatModel,
        embedModel,
        missingModels: [chatModel, embedModel],
        error: error instanceof Error ? error.message : "vLLM is unreachable",
      };
    }
  }

  async answer(question: string, matches: any[]) {
    const { chatModel } = this.getConf();
    const contextText = matches
      .map((match) => `${match.citation} File: ${match.documentName}; page: ${match.page}\n${match.text}`)
      .join("\n\n");
    const groundedPrompt = `Question:\n${question}\n\nRelevant private context:\n${contextText}`;

    const response = await this.vllmFetch("/v1/chat/completions", {
      model: chatModel,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
        },
        { role: "user", content: groundedPrompt },
      ],
    });

    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const rawAnswer = payload.choices?.[0]?.message?.content?.trim();
    if (!rawAnswer) throw new Error(`vLLM model ${chatModel} returned an empty answer.`);

    const unique = [];
    const seen = new Set();
    for (const match of matches) {
      const key = `${match.documentName}:${match.page}`;
      if (!seen.has(key)) {
        unique.push(`${match.citation} ${match.documentName}, page ${match.page}`);
        seen.add(key);
      }
    }
    const finalAnswer = /\[S\d+\]/.test(rawAnswer) ? rawAnswer : `${rawAnswer}\n\nSources: ${unique.join("; ")}`;

    return {
      answer: finalAnswer,
      sources: matches.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        name: match.documentName,
        page: match.page,
        excerpt: match.text.slice(0, 240),
        score: Number(match.score.toFixed(4)),
      })),
    };
  }

  async *streamAnswer(question: string, matches: any[]) {
    yield {
      type: "sources",
      sources: matches.map((match) => ({
        citation: match.citation,
        documentId: match.documentId,
        name: match.documentName,
        page: match.page,
        excerpt: match.text.slice(0, 240),
        score: Number(match.score.toFixed(4)),
      }))
    };

    const { chatModel } = this.getConf();
    const contextText = matches
      .map((match) => `${match.citation} File: ${match.documentName}; page: ${match.page}\n${match.text}`)
      .join("\n\n");
    const groundedPrompt = `Question:\n${question}\n\nRelevant private context:\n${contextText}`;

    log.info(`Requesting streaming chat completion from vLLM: ${chatModel}`);
    const response = await this.vllmFetch("/v1/chat/completions", {
      model: chatModel,
      temperature: 0.1,
      stream: true,
      messages: [
        {
          role: "system",
          content: "You are a private document assistant. Answer only from the supplied context. Cite factual claims with the exact source labels such as [S1]. If the context is insufficient, say so. Never invent a fact or citation.",
        },
        { role: "user", content: groundedPrompt },
      ],
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error("vLLM response has no readable stream.");

    const decoder = new TextDecoder();
    let buffer = "";
    try {
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
            if (dataText === "[DONE]") continue;
            try {
              const parsed = JSON.parse(dataText) as { choices?: { delta?: { content?: string } }[] };
              const chunk = parsed.choices?.[0]?.delta?.content || "";
              if (chunk) yield { type: "text", content: chunk };
            } catch {}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "ollama";
  if (provider === "vllm") {
    return new VllmLLMProvider();
  }
  return new OllamaLLMProvider();
}
