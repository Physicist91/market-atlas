export type Source = {
    id: string;
    title: string;
    publisher: string;
    url: string;
    topic: string;
    date: string | null;
    fetchedAt: string | null;
    text: string;
    status: 'baseline' | 'live' | 'unavailable';
    kind: 'Article' | 'Market data' | 'Research' | 'API';
    error?: string;
    hash?: string;
};

export const seed: Source[] = [
    { id: 'woh-market', title: 'Wohlers Report 2026: the public market baseline', publisher: 'Wohlers Associates', url: 'https://wohlersassociates.com/press-releases/new-wohlers-report-2026-values-additive-manufacturing-market-at-24-2b/', topic: 'Market economics', date: '2026-02-17', text: 'Global additive manufacturing revenue reached $24.2 billion in 2025, up 10.9%. Revenue shares: printing services 48%, systems and servicing 26%, materials 20%, software 6%. Services grew 15.5%; system sales grew 3.6%. Average company revenue growth: Asia-Pacific 19.8%, Americas 12.6%, EMEA 9.0%. These regional measures are company averages, not market shares. The public release describes an industry focused on utilization and production outcomes.', status: 'baseline', fetchedAt: null, kind: 'Market data' },
    { id: 'woh-method', title: 'From paintings to maps: live market intelligence', publisher: 'Wohlers Associates', url: 'https://wohlersassociates.com/opinion/from-paintings-to-maps-why-additive-manufacturing-needs-live-market-intelligence/', topic: 'Methodology', date: '2026-01-14', text: 'Wohlers argues that annual snapshots cannot capture changing AM competition. Low-cost printer farms blur desktop and industrial categories. Transparent source coverage and methods help users compare market estimates. Connecting technical intelligence with financial decisions reduces fragmented decision-making. A continuously updated landscape supports aligned strategy, investment, and execution.', status: 'baseline', fetchedAt: null, kind: 'Article' },
    { id: 'woh-insights', title: 'Wohlers reports and insights index', publisher: 'Wohlers Platform', url: 'https://platform.wohlersassociates.com/insights', topic: 'Market intelligence', date: null, text: 'The public index lists annual reports, quarterly updates, specialty reports, and articles. Topics include autonomous manufacturing, defense-policy signals, low-cost printers, and regional AM developments. Some material requires an account or purchase; this demo uses only the public index and does not access licensed report bodies.', status: 'baseline', fetchedAt: null, kind: 'Article' },
    { id: 'nist-qualification', title: 'Qualification of AM materials, processes, and parts', publisher: 'NIST', url: 'https://www.nist.gov/programs-projects/qualification-additive-manufacturing-materials-processes-and-parts', topic: 'Qualification', date: null, text: 'NIST develops measurement methods, reference data, and protocols that support faster additive manufacturing qualification. Its role is research and measurement science; regulatory bodies establish actual qualification requirements. Technical validation and test methods are important adoption considerations.', status: 'baseline', fetchedAt: null, kind: 'Research' },
    { id: 'nist-materials', title: 'Materials science for additive manufacturing', publisher: 'NIST', url: 'https://www.nist.gov/additive-manufacturing/our-team/material-measurement-laboratory', topic: 'Materials', date: null, text: 'NIST materials research develops standards and reference materials to support AM adoption. Its work addresses qualification, certification, and measurement science. AM Bench provides benchmark challenges for the research community.', status: 'baseline', fetchedAt: null, kind: 'Research' },
    { id: 'nist-am', title: 'Additive manufacturing research at NIST', publisher: 'NIST', url: 'https://www.nist.gov/additive-manufacturing', topic: 'Advanced manufacturing', date: null, text: 'NIST additive manufacturing research focuses on measurement science, manufacturing processes, and standards. Its research projects and publications provide technical evidence for assessing manufacturing adoption.', status: 'baseline', fetchedAt: null, kind: 'Research' }
];

export const metrics = { year: 2025, revenue: 24.2, growth: 10.9, segments: [{ name: 'Printing services', share: 48 }, { name: 'Systems & servicing', share: 26 }, { name: 'Materials', share: 20 }, { name: 'Software', share: 6 }], regions: [{ name: 'Asia-Pacific', growth: 19.8 }, { name: 'Americas', growth: 12.6 }, { name: 'EMEA', growth: 9.0 }], sourceId: 'woh-market', period: '2025', scope: 'Global additive manufacturing', units: 'USD billions; percent', method: 'Public report-release figures; regional growth is average company revenue growth. Full survey methodology is not available in this demo.' };

const ALLOWED = new Set(['wohlersassociates.com', 'platform.wohlersassociates.com', 'www.nist.gov', 'api.crossref.org']);
const headers = { 'User-Agent': 'ManufacturingAtlasResearchDemo/1.0', 'Accept': 'text/html,application/json' };

async function boundedFetch(url: string) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname))
        throw new Error('Source host not allowed');
    const r = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });
    if (r.status >= 300 && r.status < 400) {
        const dest = new URL(r.headers.get('location') || '', url);
        if (dest.href === url)
            throw new Error('Redirect loop');
        return boundedFetchOnce(dest.href);
    }
    if (!r.ok)
        throw new Error('Source returned HTTP ' + r.status);
    return readBounded(r);
}

async function boundedFetchOnce(url: string) {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname))
        throw new Error('Redirect outside source allowlist');
    const r = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!r.ok)
        throw new Error('Source returned HTTP ' + r.status);
    return readBounded(r);
}

async function readBounded(r: Response) {
    const reader = r.body?.getReader();
    if (!reader)
        throw new Error('Empty response');
    let total = 0, out = '';
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > 1500000) {
            await reader.cancel();
            throw new Error('Source exceeds collection limit');
        }
        out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
}

const robots = new Map<string, Promise<string>>();
async function permitted(url: string) {
    const u = new URL(url);
    if (!robots.has(u.origin))
        robots.set(u.origin, boundedFetch(u.origin + '/robots.txt').catch(e => String(e).includes('HTTP 404') ? '' : Promise.reject(e)));
    const txt = await robots.get(u.origin)!;
    let applies = false;
    const rules: { path: string; allow: boolean }[] = [];
    for (const line of txt.split('\n')) {
        const [key, ...rest] = line.split(':');
        const value = rest.join(':').split('#')[0].trim();
        if (key.trim().toLowerCase() === 'user-agent')
            applies = value === '*' || value.toLowerCase().includes('manufacturingatlas');
        else if (applies && ['allow', 'disallow'].includes(key.trim().toLowerCase()) && value)
            rules.push({ path: value, allow: key.trim().toLowerCase() === 'allow' });
    }
    const matches = rules.filter(x => {
        const p = x.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        try {
            return new RegExp('^' + p).test(u.pathname);
        } catch {
            return false;
        }
    }).sort((a, b) => b.path.length - a.path.length);
    return !matches.length || matches[0].allow;
}

export function cleanHtml(html: string) {
    const content = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
    return content.replace(/<(script|style|nav|header|footer|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 24000);
}

// Keep excluded personal and institutional attribution out of collected passages.
const excludedAttribution = /\b(?:interviews?|mahdi(?:\s+jamshid)?|astm(?:\s+international)?)\b/i;
export function hasExcludedAttribution(text: string) {
    return excludedAttribution.test(text);
}
export function omitExcludedAttribution(text: string) {
    return text.split(/(?<=[.!?])\s+/).filter(sentence => !hasExcludedAttribution(sentence)).join(' ').trim();
}

let cached: Source[] = seed;
let checkedAt: string | null = null;
let lastAttempt = 0;
let pending: Promise<ReturnType<typeof snapshot>> | null = null;

export function snapshot() {
    return {
        sources: cached,
        metrics,
        checkedAt,
        storage: 'Worker memory cache, up to 15 minutes; no persistent user data',
        live: cached.filter(s => s.status === 'live').length
    };
}

export async function refresh() {
    if (pending)
        return pending;
    if (Date.now() - lastAttempt < 60000)
        return snapshot();
    lastAttempt = Date.now();
    pending = (async () => {
        const results: Source[] = [];
        for (let i = 0; i < seed.length; i += 3) {
            const batch = await Promise.all(seed.slice(i, i + 3).map(async (s) => {
                try {
                    if (!await permitted(s.url))
                        throw new Error('Collection restricted by robots.txt');
                    const html = await boundedFetch(s.url);
                    const text = omitExcludedAttribution(cleanHtml(html));
                    if (text.length < 150 || /enable javascript|checking your browser|just a moment/i.test(text.slice(0, 400)))
                        throw new Error('Page content unavailable');
                    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
                    return { ...s, text, status: 'live' as const, fetchedAt: new Date().toISOString(), hash };
                } catch (e) {
                    const prev = cached.find(x => x.id === s.id) || s;
                    return { ...prev, status: 'unavailable' as const, error: e instanceof Error ? e.message : 'Collection failed' };
                }
            }));
            results.push(...batch);
        }
        try {
            const url = 'https://api.crossref.org/works?query.title=additive%20manufacturing&filter=type:journal-article,until-pub-date:' + new Date().toISOString().slice(0, 10) + '&sort=published&order=desc&rows=30';
            const data = JSON.parse(await boundedFetch(url));
            for (const item of data.message.items || []) {
                if (hasExcludedAttribution(String(item.title?.[0] || '') + ' ' + String(item.publisher || '')) || !/additive manufactur|3[dD][ -]print/i.test(String(item.title?.[0] || '')))
                    continue;
                if (results.filter(s => s.kind === 'API').length >= 5)
                    break;
                const date = item.published?.['date-parts']?.[0]?.join('-') || null;
                if (date && new Date(date) > new Date())
                    continue;
                const doi = String(item.DOI || '');
                if (!/^10\.\d{4,9}\/[\S]+$/.test(doi))
                    continue;
                results.push({
                    id: 'crossref-' + doi,
                    title: String(item.title?.[0] || 'AM research'),
                    publisher: String(item.publisher || 'Crossref'),
                    url: 'https://doi.org/' + encodeURIComponent(doi),
                    topic: 'Research literature',
                    date,
                    fetchedAt: new Date().toISOString(),
                    text: String(item.title?.[0] || '') + '. ' + (item.abstract ? omitExcludedAttribution(cleanHtml(item.abstract)) : 'Bibliographic metadata only; no abstract available. This record cannot support detailed claims about results.'),
                    status: 'live',
                    kind: 'API'
                });
            }
        } catch (e) {
            results.push({
                id: 'crossref-error',
                title: 'Crossref research discovery',
                publisher: 'Crossref',
                url: 'https://api.crossref.org',
                topic: 'Research literature',
                date: null,
                fetchedAt: null,
                text: 'The live research discovery API is currently unavailable. No research results were inferred.',
                status: 'unavailable',
                kind: 'API',
                error: e instanceof Error ? e.message : 'API unavailable'
            });
        }
        cached = results;
        checkedAt = new Date().toISOString();
        return snapshot();
    })().finally(() => {
        pending = null;
    });
    return pending;
}

export async function corpus() {
    if (!checkedAt) {
        if (!pending && Date.now() - lastAttempt >= 60000) {
            void refresh().catch(() => {});
        }
    } else if (Date.now() - Date.parse(checkedAt) > 900000) {
        if (!pending && Date.now() - lastAttempt >= 60000) {
            void refresh().catch(() => {});
        }
    }
    return snapshot();
}

const stop = new Set('a an the is are was were how why what which of in to and or for on by with from this that does do have has us me tell about can more'.split(' '));

export function tokens(text: string) {
    return text.toLowerCase()
        .replace(/3d/g, 'additive manufacturing')
        .replace(/\bam\b/g, 'additive manufacturing')
        .match(/[a-z0-9]+/g)?.filter(t => !stop.has(t) && t.length > 1) || [];
}

export type ChunkMatch = {
    source: Source;
    text: string;
    index: number;
    score: number;
    hits?: number;
    bm25Score?: number;
    denseScore?: number;
    method?: 'hybrid' | 'bm25' | 'dense';
};

export type HybridResult = {
    matches: ChunkMatch[];
    trace: {
        retrieval: string;
        sparseCandidates: number;
        denseCandidates: number;
        fusionMethod: string;
        chunkWords: number;
        overlapWords: number;
        candidates: number;
        returned: number;
        latencyMs: number;
    };
};

// In-memory embedding cache: passage-hash/id -> vector
const embeddingCache = new Map<string, number[]>();

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 256-dimensional sub-word / character trigram vectorizer for deterministic offline dense similarity
function localEmbedding(text: string, dims = 256): number[] {
    const vec = new Float64Array(dims);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean);
    for (const w of words) {
        const padded = `_${w}_`;
        for (let i = 0; i < padded.length - 2; i++) {
            const gram = padded.slice(i, i + 3);
            let h = 0;
            for (let j = 0; j < gram.length; j++) {
                h = (h * 31 + gram.charCodeAt(j)) >>> 0;
            }
            const idx = h % dims;
            vec[idx] += 1;
        }
    }
    let norm = 0;
    for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
        for (let i = 0; i < dims; i++) vec[i] /= norm;
    }
    return Array.from(vec);
}

async function fetchGeminiEmbedding(text: string, apiKey: string): Promise<number[] | null> {
    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text: text.slice(0, 2000) }] }
            }),
            signal: AbortSignal.timeout(3500)
        });
        if (!r.ok) return null;
        const d: any = await r.json();
        return d.embedding?.values || null;
    } catch {
        return null;
    }
}

// Synchronous BM25 baseline retrieval
export function retrieve(question: string, sources: Source[], topic = 'All topics'): ChunkMatch[] {
    const q = tokens(question);
    const chunks = sources.filter(s => topic === 'All topics' || s.topic === topic).filter(s => s.id !== 'crossref-error').flatMap(s => {
        const words = s.text.split(/\s+/);
        const out: { source: Source; text: string; index: number }[] = [];
        for (let i = 0; i < words.length; i += 170)
            out.push({ source: s, text: words.slice(i, i + 220).join(' '), index: i / 170 });
        return out;
    });
    const terms = chunks.map(c => tokens(c.source.title + ' ' + c.text));
    const avg = terms.reduce((n, t) => n + t.length, 0) / Math.max(1, terms.length);
    return chunks.map((c, i) => {
        let score = 0;
        let hits = 0;
        for (const t of new Set(q)) {
            const df = terms.filter(ts => ts.includes(t)).length;
            const tf = terms[i].filter(x => x === t).length;
            if (tf) {
                hits++;
                score += Math.log(1 + (chunks.length - df + .5) / (df + .5)) * tf * 2.2 / (tf + 1.2 * (.25 + .75 * terms[i].length / avg));
            }
        }
        return { ...c, score: Math.round(score * 1000) / 1000, hits, bm25Score: Math.round(score * 1000) / 1000, method: 'bm25' as const };
    })
    .filter(c => c.hits >= Math.min(2, new Set(q).size) && c.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((c, i, all) => all.slice(0, i).filter(x => x.source.id === c.source.id).length < 2)
    .slice(0, 6);
}

// Hybrid Retrieval: BM25 Sparse + Dense Semantic Embeddings with Reciprocal Rank Fusion (RRF)
export async function retrieveHybrid(
    question: string,
    sources: Source[],
    topic = 'All topics',
    keys?: { geminiKey?: string; openaiKey?: string }
): Promise<HybridResult> {
    const startTime = Date.now();
    const q = tokens(question);
    const candidateSources = sources.filter(s => topic === 'All topics' || s.topic === topic).filter(s => s.id !== 'crossref-error');

    // 1. Chunking
    const chunks: { source: Source; text: string; index: number; id: string }[] = [];
    for (const s of candidateSources) {
        const words = s.text.split(/\s+/);
        for (let i = 0; i < words.length; i += 170) {
            const text = words.slice(i, i + 220).join(' ');
            chunks.push({
                source: s,
                text,
                index: i / 170,
                id: `${s.id}-${Math.floor(i / 170)}`
            });
        }
    }

    if (!chunks.length) {
        return {
            matches: [],
            trace: {
                retrieval: 'Hybrid (BM25 + Semantic Vectors with RRF)',
                sparseCandidates: 0,
                denseCandidates: 0,
                fusionMethod: 'Reciprocal Rank Fusion (RRF, k=60)',
                chunkWords: 220,
                overlapWords: 50,
                candidates: 0,
                returned: 0,
                latencyMs: Date.now() - startTime
            }
        };
    }

    // 2. Sparse BM25 Scoring
    const terms = chunks.map(c => tokens(c.source.title + ' ' + c.text));
    const avg = terms.reduce((n, t) => n + t.length, 0) / Math.max(1, terms.length);
    const sparseRanked = chunks.map((c, i) => {
        let score = 0;
        let hits = 0;
        for (const t of new Set(q)) {
            const df = terms.filter(ts => ts.includes(t)).length;
            const tf = terms[i].filter(x => x === t).length;
            if (tf) {
                hits++;
                score += Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5)) * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * terms[i].length / avg));
            }
        }
        return { chunk: c, bm25Score: Math.round(score * 1000) / 1000, hits };
    })
    .filter(item => item.bm25Score > 0)
    .sort((a, b) => b.bm25Score - a.bm25Score);

    // 3. Dense Vector Embeddings Scoring
    let queryEmbedding: number[] | null = null;
    let usedDenseProvider = 'Local Semantic Sub-word Vectors';

    if (keys?.geminiKey) {
        queryEmbedding = await fetchGeminiEmbedding(question, keys.geminiKey);
        if (queryEmbedding) {
            usedDenseProvider = 'Gemini text-embedding-004';
        }
    }

    if (!queryEmbedding) {
        queryEmbedding = localEmbedding(question);
    }

    const denseRanked: { chunk: typeof chunks[0]; denseScore: number }[] = [];
    for (const c of chunks) {
        let vec = embeddingCache.get(c.id);
        if (!vec) {
            if (usedDenseProvider === 'Gemini text-embedding-004' && keys?.geminiKey) {
                vec = (await fetchGeminiEmbedding(c.source.title + ': ' + c.text, keys.geminiKey)) || localEmbedding(c.source.title + ' ' + c.text);
            } else {
                vec = localEmbedding(c.source.title + ' ' + c.text);
            }
            if (vec) embeddingCache.set(c.id, vec);
        }
        const sim = cosineSimilarity(queryEmbedding, vec);
        denseRanked.push({ chunk: c, denseScore: Math.round(sim * 1000) / 1000 });
    }
    denseRanked.sort((a, b) => b.denseScore - a.denseScore);

    // 4. Reciprocal Rank Fusion (RRF, k=60)
    const RRF_K = 60;
    const rrfMap = new Map<string, {
        chunk: typeof chunks[0];
        rrfScore: number;
        bm25Score: number;
        denseScore: number;
        hits: number;
    }>();

    sparseRanked.forEach((item, rank) => {
        const id = item.chunk.id;
        const current = rrfMap.get(id) || {
            chunk: item.chunk,
            rrfScore: 0,
            bm25Score: item.bm25Score,
            denseScore: 0,
            hits: item.hits
        };
        current.rrfScore += 1 / (RRF_K + rank + 1);
        current.bm25Score = item.bm25Score;
        current.hits = item.hits;
        rrfMap.set(id, current);
    });

    denseRanked.forEach((item, rank) => {
        const id = item.chunk.id;
        const current = rrfMap.get(id) || {
            chunk: item.chunk,
            rrfScore: 0,
            bm25Score: 0,
            denseScore: item.denseScore,
            hits: 0
        };
        current.rrfScore += 1 / (RRF_K + rank + 1);
        current.denseScore = item.denseScore;
        rrfMap.set(id, current);
    });

    // 5. Deduplicate (max 2 chunks per parent source) and take top 6
    const combined = Array.from(rrfMap.values())
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .filter((item, idx, arr) => {
            const count = arr.slice(0, idx).filter(x => x.chunk.source.id === item.chunk.source.id).length;
            return count < 2;
        })
        .slice(0, 6);

    const matches: ChunkMatch[] = combined.map(item => ({
        source: item.chunk.source,
        text: item.chunk.text,
        index: item.chunk.index,
        score: Math.round(item.rrfScore * 10000) / 10000,
        hits: item.hits,
        bm25Score: item.bm25Score,
        denseScore: item.denseScore,
        method: item.bm25Score > 0 && item.denseScore > 0 ? 'hybrid' : (item.bm25Score > 0 ? 'bm25' : 'dense')
    }));

    return {
        matches,
        trace: {
            retrieval: `Hybrid (BM25 Sparse + ${usedDenseProvider} with RRF)`,
            sparseCandidates: sparseRanked.length,
            denseCandidates: denseRanked.length,
            fusionMethod: 'Reciprocal Rank Fusion (RRF, k=60)',
            chunkWords: 220,
            overlapWords: 50,
            candidates: candidateSources.length,
            returned: matches.length,
            latencyMs: Date.now() - startTime
        }
    };
}

export function relevantExcerpt(question: string, text: string) {
    const q = new Set(tokens(question));
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.map((t, i) => ({ t, i, score: tokens(t).filter(x => q.has(x)).length }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .sort((a, b) => a.i - b.i)
        .map(x => x.t.trim())
        .join(' ')
        .split(/\s+/)
        .slice(0, 85)
        .join(' ');
}
