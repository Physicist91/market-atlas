import { corpus, refresh } from '@/lib/corpus';
export async function GET() { try {
    return Response.json(await corpus());
}
catch {
    return Response.json({ error: 'Source collection unavailable' }, { status: 503 });
} }
export async function POST(request: Request) { const origin = request.headers.get('origin'); if (origin && origin !== new URL(request.url).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 }); return Response.json(await refresh()); }
