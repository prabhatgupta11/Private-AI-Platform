import fs from "node:fs";
import path from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { log } from "../logger";

export interface StorageProvider {
  put(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    options?: { contentType?: string }
  ): Promise<void>;
  get(key: string): Promise<{
    json<T>(): Promise<T>;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
  } | null>;
  delete(keys: string | string[]): Promise<void>;
}

// Local Storage Provider
class LocalStorageProvider implements StorageProvider {
  private getPath(key: string) {
    const storageDir = path.resolve(process.cwd(), "data", "storage");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const safeKey = key.replace(/\//g, "_"); // flatten directories to avoid missing folder traps
    return path.join(storageDir, safeKey);
  }

  private async bodyToBuffer(body: ReadableStream | ArrayBuffer | string): Promise<Buffer> {
    if (typeof body === "string") {
      return Buffer.from(body);
    }
    if (body instanceof ArrayBuffer) {
      return Buffer.from(body);
    }
    // Handle ReadableStream
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  async put(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    options?: { contentType?: string }
  ): Promise<void> {
    const filePath = this.getPath(key);
    const buffer = await this.bodyToBuffer(body);
    fs.writeFileSync(filePath, buffer);
  }

  async get(key: string) {
    const filePath = this.getPath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    return {
      async json<T>(): Promise<T> {
        return JSON.parse(buffer.toString("utf8")) as T;
      },
      async arrayBuffer(): Promise<ArrayBuffer> {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      },
      async text(): Promise<string> {
        return buffer.toString("utf8");
      },
    };
  }

  async delete(keys: string | string[]): Promise<void> {
    const toDelete = Array.isArray(keys) ? keys : [keys];
    for (const key of toDelete) {
      try {
        const filePath = this.getPath(key);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        log.warn(`Failed to delete local file for key: ${key}`, e);
      }
    }
  }
}

// MinIO Storage Provider
class MinioStorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000";
    const accessKeyId = process.env.MINIO_ACCESS_KEY || "minioadmin";
    const secretAccessKey = process.env.MINIO_SECRET_KEY || "minioadmin";
    this.bucket = process.env.MINIO_BUCKET || "privateai-documents";

    this.client = new S3Client({
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      region: "us-east-1",
      forcePathStyle: true, // required for MinIO
    });

    // Run bucket creation asynchronously in background
    this.initBucket();
  }

  private async initBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        log.info(`Creating MinIO bucket: "${this.bucket}"`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch (err) {
        log.error(`Failed to initialize MinIO bucket "${this.bucket}":`, err);
      }
    }
  }

  private async bodyToBuffer(body: ReadableStream | ArrayBuffer | string): Promise<Buffer> {
    if (typeof body === "string") {
      return Buffer.from(body);
    }
    if (body instanceof ArrayBuffer) {
      return Buffer.from(body);
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  }

  async put(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    options?: { contentType?: string }
  ): Promise<void> {
    const buffer = await this.bodyToBuffer(body);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: options?.contentType || "application/octet-stream",
    }));
  }

  async get(key: string) {
    try {
      const res = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      if (!res.Body) return null;
      // Convert stream/webStream to buffer
      const bytes = await res.Body.transformToByteArray();
      const buffer = Buffer.from(bytes);

      return {
        async json<T>(): Promise<T> {
          return JSON.parse(buffer.toString("utf8")) as T;
        },
        async arrayBuffer(): Promise<ArrayBuffer> {
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
        },
        async text(): Promise<string> {
          return buffer.toString("utf8");
        },
      };
    } catch {
      return null;
    }
  }

  async delete(keys: string | string[]): Promise<void> {
    const toDelete = Array.isArray(keys) ? keys : [keys];
    if (toDelete.length === 0) return;

    try {
      await this.client.send(new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: toDelete.map((k) => ({ Key: k })),
          Quiet: true,
        },
      }));
    } catch (e) {
      log.warn("Failed to delete objects from MinIO", e);
    }
  }
}

export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_TYPE || "local";
  if (provider === "minio") {
    return new MinioStorageProvider();
  }
  return new LocalStorageProvider();
}
