import { QdrantClient } from "@qdrant/js-client-rest"

let client: QdrantClient | null = null

export function getQdrantClient(): QdrantClient {
  if (!client) {
    const url = process.env.QDRANT_URL ?? "http://localhost:6333"
    client = new QdrantClient({ url, checkCompatibility: false })
  }
  return client
}

export function getCollection(): string {
  return process.env.QDRANT_COLLECTION ?? "openclaw-memories"
}
