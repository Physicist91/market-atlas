import { snapshot } from '@/lib/corpus';

export async function GET() {
  const isConfigured = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  return Response.json({
    generation: isConfigured ? 'configured' : 'retrieval-only',
    provider: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY)
      ? 'gemini'
      : (process.env.OPENAI_API_KEY ? 'openai' : null),
    model: process.env.GEMINI_MODEL || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? 'gemini-3.8-flash' : (process.env.OPENAI_MODEL || null)),
    ...snapshot()
  });
}
