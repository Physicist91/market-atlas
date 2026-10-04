import { snapshot } from '@/lib/corpus';

export async function GET() {
  const hasGemini = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY
  );
  const hasHuggingFace = Boolean(
    process.env.HF_TOKEN ||
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_HUB_TOKEN
  );
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);

  const isConfigured = hasGemini || hasHuggingFace || hasOpenAI;

  return Response.json({
    generation: isConfigured ? 'configured' : 'retrieval-only',
    providers: {
      gemini: hasGemini,
      huggingface: hasHuggingFace,
      openai: hasOpenAI
    },
    defaultModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    ...snapshot()
  });
}
