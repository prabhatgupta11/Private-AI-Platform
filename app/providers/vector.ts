/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDb, runRawSql } from "../../db";
import { cosineSimilarity } from "../rag-core";
import { log } from "../logger";

export interface VectorMatch {
  citation: string;
  documentId: string;
  documentName: string;
  page: number;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface VectorStoreProvider {
  insert(
    id: string,
    documentId: string,
    documentName: string,
    page: number,
    chunkIndex: number,
    text: string,
    embedding: number[]
  ): Promise<void>;
  delete(documentId: string): Promise<void>;
  search(queryEmbedding: number[], limit?: number): Promise<VectorMatch[]>;
  counts(): Promise<{ chunks: number; indexedDocuments: number }>;
}

const embeddingCache = new Map<string, number[]>();

// SQLite implementation
class SqliteVectorStore implements VectorStoreProvider {
  async insert(
    id: string,
    documentId: string,
    documentName: string,
    page: number,
    chunkIndex: number,
    text: string,
    embedding: number[]
  ): Promise<void> {
    embeddingCache.set(id, embedding);
    await runRawSql(`
      INSERT INTO document_chunks (id, document_id, document_name, page, chunk_index, text, embedding)
      VALUES (
        '${id.replace(/'/g, "''")}',
        '${documentId.replace(/'/g, "''")}',
        '${documentName.replace(/'/g, "''")}',
        ${page},
        ${chunkIndex},
        '${text.replace(/'/g, "''")}',
        '${JSON.stringify(embedding)}'
      )
    `);
  }

  async delete(documentId: string): Promise<void> {
    try {
      const db = getDb();
      const dbType = process.env.DB_TYPE || "sqlite";
      let chunkRows: any[] = [];
      
      if (dbType === "postgres") {
        const res = await db.execute(`SELECT id FROM document_chunks WHERE document_id = '${documentId.replace(/'/g, "''")}'`);
        chunkRows = res.rows || res;
      } else {
        const sqlite = db.$client;
        chunkRows = sqlite.prepare("SELECT id FROM document_chunks WHERE document_id = ?").all(documentId);
      }

      for (const row of chunkRows) {
        embeddingCache.delete(row.id || row[0]);
      }
    } catch (e) {
      log.warn("Failed to evict deleted vectors from SQLite cache", e);
    }
    await runRawSql(`DELETE FROM document_chunks WHERE document_id = '${documentId.replace(/'/g, "''")}'`);
  }

  async search(queryEmbedding: number[], limit = 6): Promise<VectorMatch[]> {
    const db = getDb();
    const dbType = process.env.DB_TYPE || "sqlite";
    let chunkRows: any[] = [];

    if (dbType === "postgres") {
      const res = await db.execute(`SELECT id, document_id, document_name, page, chunk_index, text, embedding FROM document_chunks LIMIT 10000`);
      chunkRows = res.rows || res;
    } else {
      const sqlite = db.$client;
      chunkRows = sqlite.prepare("SELECT id, document_id, document_name, page, chunk_index, text, embedding FROM document_chunks LIMIT 10000").all();
    }

    const matches = chunkRows
      .map((row: any) => {
        const id = row.id || row[0];
        const documentId = row.document_id || row[1];
        const documentName = row.document_name || row[2];
        const page = Number(row.page || row[3]);
        const chunkIndex = Number(row.chunk_index || row[4]);
        const text = row.text || row[5];
        const embeddingStr = row.embedding || row[6];

        let vector = embeddingCache.get(id);
        if (!vector) {
          vector = JSON.parse(embeddingStr) as number[];
          embeddingCache.set(id, vector);
        }
        return {
          id,
          documentId,
          documentName,
          page,
          chunkIndex,
          text,
          score: cosineSimilarity(queryEmbedding, vector),
        };
      })
      .filter((match) => Number.isFinite(match.score) && match.score > 0.2)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((match, index) => ({
        citation: `[S${index + 1}]`,
        documentId: match.documentId,
        documentName: match.documentName,
        page: match.page,
        chunkIndex: match.chunkIndex,
        text: match.text,
        score: match.score,
      }));

    return matches;
  }

  async counts() {
    const db = getDb();
    const dbType = process.env.DB_TYPE || "sqlite";
    let chunks = 0;
    let indexedDocuments = 0;

    if (dbType === "postgres") {
      const chunksRes = await db.execute("SELECT COUNT(*) AS count FROM document_chunks");
      const docsRes = await db.execute("SELECT COUNT(*) AS count FROM documents WHERE status = 'ready'");
      chunks = Number(chunksRes.rows?.[0]?.count || chunksRes[0]?.count || 0);
      indexedDocuments = Number(docsRes.rows?.[0]?.count || docsRes[0]?.count || 0);
    } else {
      const sqlite = db.$client;
      chunks = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM document_chunks").get().count || 0);
      indexedDocuments = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM documents WHERE status = 'ready'").get().count || 0);
    }

    return { chunks, indexedDocuments };
  }
}

// Qdrant implementation
class QdrantVectorStore implements VectorStoreProvider {
  private getConf() {
    const qdrantUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/$/, "");
    const collection = process.env.QDRANT_COLLECTION || "privateai_chunks";
    return { qdrantUrl, collection };
  }

  private async qdrantRequest(path: string, options: RequestInit = {}) {
    const { qdrantUrl } = this.getConf();
    const response = await fetch(`${qdrantUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Qdrant API error: ${response.status} - ${text}`);
    }
    return response.json().catch(() => ({}));
  }

  private async ensureCollection(dim: number) {
    const { collection } = this.getConf();
    try {
      await this.qdrantRequest(`/collections/${collection}`);
    } catch {
      // Collection does not exist, create it
      log.info(`Creating Qdrant collection: "${collection}" with dimension: ${dim}`);
      await this.qdrantRequest(`/collections/${collection}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: {
            size: dim,
            distance: "Cosine",
          },
        }),
      });
    }
  }

  // Helper to hash string point keys into Qdrant UUID format
  private stringToUuid(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return `${hex}-0000-4000-8000-000000000000`;
  }

  async insert(
    id: string,
    documentId: string,
    documentName: string,
    page: number,
    chunkIndex: number,
    text: string,
    embedding: number[]
  ): Promise<void> {
    await this.ensureCollection(embedding.length);
    const { collection } = this.getConf();
    const pointId = this.stringToUuid(id);

    await this.qdrantRequest(`/collections/${collection}/points`, {
      method: "PUT",
      body: JSON.stringify({
        points: [
          {
            id: pointId,
            vector: embedding,
            payload: {
              document_id: documentId,
              document_name: documentName,
              page,
              chunk_index: chunkIndex,
              text,
            },
          },
        ],
      }),
    });
  }

  async delete(documentId: string): Promise<void> {
    const { collection } = this.getConf();
    try {
      await this.qdrantRequest(`/collections/${collection}/points/delete`, {
        method: "POST",
        body: JSON.stringify({
          filter: {
            must: [
              {
                key: "document_id",
                match: {
                  value: documentId,
                },
              },
            ],
          },
        }),
      });
    } catch (e) {
      log.warn("Failed to delete points from Qdrant", e);
    }
  }

  async search(queryEmbedding: number[], limit = 6): Promise<VectorMatch[]> {
    await this.ensureCollection(queryEmbedding.length);
    const { collection } = this.getConf();

    const response = await this.qdrantRequest(`/collections/${collection}/points/search`, {
      method: "POST",
      body: JSON.stringify({
        vector: queryEmbedding,
        limit,
        with_payload: true,
      }),
    }) as { result?: { score: number; payload?: { document_id: string; document_name: string; page: number; chunk_index: number; text: string } }[] };

    return (response.result || [])
      .filter((item) => item.score > 0.2)
      .map((item, index) => ({
        citation: `[S${index + 1}]`,
        documentId: item.payload?.document_id || "",
        documentName: item.payload?.document_name || "",
        page: Number(item.payload?.page || 1),
        chunkIndex: Number(item.payload?.chunk_index || 0),
        text: item.payload?.text || "",
        score: item.score,
      }));
  }

  async counts() {
    const { collection } = this.getConf();
    try {
      const res = await this.qdrantRequest(`/collections/${collection}`) as { result?: { points_count: number } };
      const chunks = res.result?.points_count || 0;
      
      // Query SQL for indexed documents count
      const db = getDb();
      const dbType = process.env.DB_TYPE || "sqlite";
      let indexedDocuments = 0;

      if (dbType === "postgres") {
        const docsRes = await db.execute("SELECT COUNT(*) AS count FROM documents WHERE status = 'ready'");
        indexedDocuments = Number(docsRes.rows?.[0]?.count || docsRes[0]?.count || 0);
      } else {
        const sqlite = db.$client;
        indexedDocuments = Number(sqlite.prepare("SELECT COUNT(*) AS count FROM documents WHERE status = 'ready'").get().count || 0);
      }

      return { chunks, indexedDocuments };
    } catch {
      return { chunks: 0, indexedDocuments: 0 };
    }
  }
}

export function getVectorStoreProvider(): VectorStoreProvider {
  const provider = process.env.VECTOR_DB_TYPE || "sqlite";
  if (provider === "qdrant") {
    return new QdrantVectorStore();
  }
  return new SqliteVectorStore();
}
