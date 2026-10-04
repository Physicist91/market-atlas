import { corpus, refresh } from '@/lib/corpus';
import { isValidOrigin } from '@/lib/utils';
export async function GET() { try {
    return Response.json(await corpus());
}
catch {
    return Response.json({ error: 'Source collection unavailable' }, { status: 503 });
} }
export async function POST(request: Request) {
    if (!isValidOrigin(request))
        return Response.json({ error: 'Invalid origin' }, { status: 403 });
    return Response.json(await refresh());
}
