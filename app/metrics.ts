// Global in-memory metrics registry for Prometheus scraping
class MetricsRegistry {
  private inferenceSum = 0;
  private inferenceCount = 0;

  private embeddingSum = 0;
  private embeddingCount = 0;

  private vectorSearchSum = 0;
  private vectorSearchCount = 0;

  recordInference(seconds: number) {
    this.inferenceSum += seconds;
    this.inferenceCount += 1;
  }

  recordEmbedding(seconds: number) {
    this.embeddingSum += seconds;
    this.embeddingCount += 1;
  }

  recordVectorSearch(seconds: number) {
    this.vectorSearchSum += seconds;
    this.vectorSearchCount += 1;
  }

  getPrometheusFormat(): string {
    const lines = [
      "# HELP privateai_inference_duration_seconds_sum Total time spent on inference in seconds.",
      "# TYPE privateai_inference_duration_seconds_sum counter",
      `privateai_inference_duration_seconds_sum ${this.inferenceSum.toFixed(4)}`,
      "",
      "# HELP privateai_inference_duration_seconds_count Number of inference requests.",
      "# TYPE privateai_inference_duration_seconds_count counter",
      `privateai_inference_duration_seconds_count ${this.inferenceCount}`,
      "",
      "# HELP privateai_embedding_duration_seconds_sum Total time spent generating embeddings in seconds.",
      "# TYPE privateai_embedding_duration_seconds_sum counter",
      `privateai_embedding_duration_seconds_sum ${this.embeddingSum.toFixed(4)}`,
      "",
      "# HELP privateai_embedding_duration_seconds_count Number of embedding requests.",
      "# TYPE privateai_embedding_duration_seconds_count counter",
      `privateai_embedding_duration_seconds_count ${this.embeddingCount}`,
      "",
      "# HELP privateai_vector_search_duration_seconds_sum Total time spent performing vector searches in seconds.",
      "# TYPE privateai_vector_search_duration_seconds_sum counter",
      `privateai_vector_search_duration_seconds_sum ${this.vectorSearchSum.toFixed(4)}`,
      "",
      "# HELP privateai_vector_search_duration_seconds_count Number of vector search requests.",
      "# TYPE privateai_vector_search_duration_seconds_count counter",
      `privateai_vector_search_duration_seconds_count ${this.vectorSearchCount}`,
      ""
    ];

    return lines.join("\n");
  }
}

// Global singleton registry instance
// Prevents duplicate definitions in Next.js development hot-reloads
const globalRef = global as unknown as { metricsRegistry?: MetricsRegistry };
if (!globalRef.metricsRegistry) {
  globalRef.metricsRegistry = new MetricsRegistry();
}

export const metrics = globalRef.metricsRegistry;
export type { MetricsRegistry };
