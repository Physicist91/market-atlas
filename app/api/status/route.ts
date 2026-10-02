import { snapshot } from '@/lib/corpus';
export async function GET() { return Response.json({ generation: process.env.OPENAI_API_KEY ? 'configured' : 'retrieval-only', ...snapshot() }); }
