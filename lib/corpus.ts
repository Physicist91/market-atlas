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
async function boundedFetch(url: string) { const u = new URL(url); if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname))
    throw new Error('Source host not allowed'); const r = await fetch(url, { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) }); if (r.status >= 300 && r.status < 400) {
    const dest = new URL(r.headers.get('location') || '', url);
    if (dest.href === url)
        throw new Error('Redirect loop');
    return boundedFetchOnce(dest.href);
} if (!r.ok)
    throw new Error('Source returned HTTP ' + r.status); return readBounded(r); }
async function boundedFetchOnce(url: string) { const u = new URL(url); if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname))
    throw new Error('Redirect outside source allowlist'); const r = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(10000) }); if (!r.ok)
    throw new Error('Source returned HTTP ' + r.status); return readBounded(r); }
async function readBounded(r: Response) { const reader = r.body?.getReader(); if (!reader)
    throw new Error('Empty response'); let total = 0, out = ''; const decoder = new TextDecoder(); while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    total += value.byteLength;
    if (total > 1500000) {
        await reader.cancel();
        throw new Error('Source exceeds collection limit');
    }
    out += decoder.decode(value, { stream: true });
} return out + decoder.decode(); }
const robots = new Map<string, Promise<string>>();
async function permitted(url: string) { const u = new URL(url); if (!robots.has(u.origin))
    robots.set(u.origin, boundedFetch(u.origin + '/robots.txt').catch(e => String(e).includes('HTTP 404') ? '' : Promise.reject(e))); const txt = await robots.get(u.origin)!; let applies = false; const rules: {
    path: string;
    allow: boolean;
}[] = []; for (const line of txt.split('\n')) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').split('#')[0].trim();
    if (key.trim().toLowerCase() === 'user-agent')
        applies = value === '*' || value.toLowerCase().includes('manufacturingatlas');
    else if (applies && ['allow', 'disallow'].includes(key.trim().toLowerCase()) && value)
        rules.push({ path: value, allow: key.trim().toLowerCase() === 'allow' });
} const matches = rules.filter(x => { const p = x.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*'); try {
    return new RegExp('^' + p).test(u.pathname);
}
catch {
    return false;
} }).sort((a, b) => b.path.length - a.path.length); return !matches.length || matches[0].allow; }
export function cleanHtml(html: string) { let content = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html; return content.replace(/<(script|style|nav|header|footer|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().slice(0, 24000); }
let cached: Source[] = seed;
let checkedAt: string | null = null;
let lastAttempt = 0;
let pending: Promise<ReturnType<typeof snapshot>> | null = null;
export function snapshot() { return { sources: cached, metrics, checkedAt, storage: 'Worker memory cache, up to 15 minutes; no persistent user data', live: cached.filter(s => s.status === 'live').length }; }
export async function refresh() { if (pending)
    return pending; if (Date.now() - lastAttempt < 60000)
    return snapshot(); lastAttempt = Date.now(); pending = (async () => { const results: Source[] = []; for (let i = 0; i < seed.length; i += 3) {
    const batch = await Promise.all(seed.slice(i, i + 3).map(async (s) => { try {
        if (!await permitted(s.url))
            throw new Error('Collection restricted by robots.txt');
        const html = await boundedFetch(s.url);
        const text = cleanHtml(html);
        if (text.length < 150 || /enable javascript|checking your browser|just a moment/i.test(text.slice(0, 400)))
            throw new Error('Page content unavailable');
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
        return { ...s, text, status: 'live' as const, fetchedAt: new Date().toISOString(), hash };
    }
    catch (e) {
        const prev = cached.find(x => x.id === s.id) || s;
        return { ...prev, status: 'unavailable' as const, error: e instanceof Error ? e.message : 'Collection failed' };
    } }));
    results.push(...batch);
} try {
    const url = 'https://api.crossref.org/works?query.title=additive%20manufacturing&filter=type:journal-article,until-pub-date:' + new Date().toISOString().slice(0, 10) + '&sort=published&order=desc&rows=30';
    const data = JSON.parse(await boundedFetch(url));
    for (const item of data.message.items || []) {
        if (!/additive manufactur|3[dD][ -]print/i.test(String(item.title?.[0] || '')))
            continue;
        if (results.filter(s => s.kind === 'API').length >= 5)
            break;
        const date = item.published?.['date-parts']?.[0]?.join('-') || null;
        if (date && new Date(date) > new Date())
            continue;
        const doi = String(item.DOI || '');
        if (!/^10\.\d{4,9}\/[\S]+$/.test(doi))
            continue;
        results.push({ id: 'crossref-' + doi, title: String(item.title?.[0] || 'AM research'), publisher: String(item.publisher || 'Crossref'), url: 'https://doi.org/' + encodeURIComponent(doi), topic: 'Research literature', date, fetchedAt: new Date().toISOString(), text: String(item.title?.[0] || '') + '. ' + (item.abstract ? cleanHtml(item.abstract) : 'Bibliographic metadata only; no abstract available. This record cannot support detailed claims about results.'), status: 'live', kind: 'API' });
    }
}
catch (e) {
    results.push({ id: 'crossref-error', title: 'Crossref research discovery', publisher: 'Crossref', url: 'https://api.crossref.org', topic: 'Research literature', date: null, fetchedAt: null, text: 'The live research discovery API is currently unavailable. No research results were inferred.', status: 'unavailable', kind: 'API', error: e instanceof Error ? e.message : 'API unavailable' });
} cached = results; checkedAt = new Date().toISOString(); return snapshot(); })().finally(() => { pending = null; }); return pending; }
export async function corpus() { if (!checkedAt || Date.now() - Date.parse(checkedAt) > 900000)
    return refresh(); return snapshot(); }
const stop = new Set('a an the is are was were how why what which of in to and or for on by with from this that does do have has us me tell about can more'.split(' '));
export function tokens(text: string) { return text.toLowerCase().replace(/3d/g, 'additive manufacturing').replace(/\bam\b/g, 'additive manufacturing').match(/[a-z0-9]+/g)?.filter(t => !stop.has(t) && t.length > 1) || []; }
export function retrieve(question: string, sources: Source[], topic = 'All topics') { const q = tokens(question); const chunks = sources.filter(s => topic === 'All topics' || s.topic === topic).filter(s => s.id !== 'crossref-error').flatMap(s => { const words = s.text.split(/\s+/); const out: {
    source: Source;
    text: string;
    index: number;
}[] = []; for (let i = 0; i < words.length; i += 170)
    out.push({ source: s, text: words.slice(i, i + 220).join(' '), index: i / 170 }); return out; }); const terms = chunks.map(c => tokens(c.source.title + ' ' + c.text)); const avg = terms.reduce((n, t) => n + t.length, 0) / Math.max(1, terms.length); return chunks.map((c, i) => { let score = 0; let hits = 0; for (const t of new Set(q)) {
    const df = terms.filter(ts => ts.includes(t)).length;
    const tf = terms[i].filter(x => x === t).length;
    if (tf) {
        hits++;
        score += Math.log(1 + (chunks.length - df + .5) / (df + .5)) * tf * 2.2 / (tf + 1.2 * (.25 + .75 * terms[i].length / avg));
    }
} return { ...c, score: Math.round(score * 1000) / 1000, hits }; }).filter(c => c.hits >= Math.min(2, new Set(q).size) && c.score > 0).sort((a, b) => b.score - a.score).filter((c, i, all) => all.slice(0, i).filter(x => x.source.id === c.source.id).length < 2).slice(0, 6); }
export function relevantExcerpt(question: string, text: string) { const q = new Set(tokens(question)); const sentences = text.split(/(?<=[.!?])\s+/); return sentences.map((t, i) => ({ t, i, score: tokens(t).filter(x => q.has(x)).length })).sort((a, b) => b.score - a.score).slice(0, 2).sort((a, b) => a.i - b.i).map(x => x.t.trim()).join(' ').split(/\s+/).slice(0, 85).join(' '); }
