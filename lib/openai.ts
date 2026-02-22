import OpenAI from "openai"

let client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return client
}

export async function embedQuery(query: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
  const openai = getOpenAIClient()
  const response = await openai.embeddings.create({
    model,
    input: query,
  })
  return response.data[0].embedding
}
