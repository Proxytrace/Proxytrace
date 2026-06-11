/**
 * Quick-start code snippets shown on the setup wizard's final step.
 *
 * Every snippet makes the same point: keep your existing provider API key and
 * swap only the base URL for the project-scoped Proxytrace proxy endpoint.
 */

export type SnippetLanguage = 'python' | 'typescript' | 'csharp' | 'curl';

export interface QuickStartSnippet {
  id: SnippetLanguage;
  /** Tab label. */
  label: string;
  /** Language hint rendered in the code block corner. */
  language: string;
  code: string;
}

export function buildQuickStartSnippets(baseUrl: string, model: string): QuickStartSnippet[] {
  return [
    {
      id: 'python',
      label: 'Python',
      language: 'python',
      code: `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",  # ← only this changes
    api_key=os.environ["OPENAI_API_KEY"],  # your existing provider key
)

response = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hello from Proxytrace!"}],
)`,
    },
    {
      id: 'typescript',
      label: 'TypeScript',
      language: 'typescript',
      code: `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${baseUrl}', // ← only this changes
  apiKey: process.env.OPENAI_API_KEY, // your existing provider key
});

const response = await client.chat.completions.create({
  model: '${model}',
  messages: [{ role: 'user', content: 'Hello from Proxytrace!' }],
});`,
    },
    {
      id: 'csharp',
      label: 'C#',
      language: 'csharp',
      code: `using System.ClientModel;
using OpenAI.Chat;

var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY"); // your existing provider key

var client = new ChatClient(
    model: "${model}",
    credential: new ApiKeyCredential(apiKey),
    options: new OpenAI.OpenAIClientOptions
    {
        Endpoint = new Uri("${baseUrl}"), // ← only this changes
    });

ChatCompletion completion = client.CompleteChat("Hello from Proxytrace!");`,
    },
    {
      id: 'curl',
      label: 'curl',
      language: 'bash',
      code: `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello from Proxytrace!"}]
  }'`,
    },
  ];
}
