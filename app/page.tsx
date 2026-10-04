"use client";
import { useEffect, useState, useCallback } from 'react';
import { BarChart3, BookOpen, Database, Globe2, Layers3, Sparkles, ChevronRight, RefreshCw, Search, Send, Download, ExternalLink, CheckCircle2, Clock, FileJson, ShieldCheck, Activity, AlertCircle, Menu, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from '@/components/ui/table';
import Overview from '@/components/overview';
import { seed, type Source } from '@/lib/corpus';

const nav = [
    ['overview', 'Market overview', BarChart3],
    ['assistant', 'Research assistant', Sparkles],
    ['sources', 'Sources & insights', BookOpen],
    ['pipeline', 'Data pipeline', Database]
] as const;

const prompts = [
    'How does services growth compare with system sales?',
    'Why do low-cost printer farms change market definitions?',
    'What does the evidence say about AM qualification?',
    'What are the limitations of regional growth comparisons?'
];

type Evidence = {
    number: number;
    id: string;
    title: string;
    url: string;
    publisher: string;
    date: string | null;
    fetchedAt: string | null;
    status: string;
    excerpt: string;
    score: number;
    chunk: number;
};

type Answer = {
    answer: string;
    evidence: Evidence[];
    mode: string;
    warning: string | null;
    checkedAt: string | null;
    trace: Record<string, unknown>;
};

const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' }) : 'Not fetched';

function download(name: string, data: string, type = 'text/markdown') {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

const AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash-lite', label: 'Google Gemini 2.5 Flash-Lite (Lowest Cost / Free Tier)' },
    { id: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash (Standard)' },
    { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'HF: Qwen 2.5 72B Instruct' },
    { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'HF: Llama 3.3 70B Instruct' },
    { id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', label: 'HF: DeepSeek R1 Distill 32B' },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'HF: Mistral 7B Instruct v0.3' },
    { id: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini' },
    { id: 'retrieval-only', label: 'Extractive Retrieval Only (No LLM)' },
] as const;

export default function Home() {
    const [view, setView] = useState<'overview' | 'assistant' | 'sources' | 'pipeline'>('overview');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [sources, setSources] = useState<Source[]>(seed);
    const [checkedAt, setCheckedAt] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [generation, setGeneration] = useState('retrieval-only');
    const [providers, setProviders] = useState<{ gemini?: boolean; huggingface?: boolean; openai?: boolean }>({});
    const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash-lite');
    const [query, setQuery] = useState('');
    const [topic, setTopic] = useState('All topics');
    const [question, setQuestion] = useState('');
    const [asked, setAsked] = useState('');
    const [answer, setAnswer] = useState<Answer | null>(null);
    const [asking, setAsking] = useState(false);
    const [detail, setDetail] = useState<Source | null>(null);

    const switchView = useCallback((id: 'overview' | 'assistant' | 'sources' | 'pipeline') => {
        setView(id);
        setMobileOpen(false);
    }, []);

    const collect = useCallback(async (method = 'POST') => {
        setBusy(true);
        setError('');
        try {
            const r = await fetch('/api/sources', { method });
            if (!r.ok) {
                let errorMsg = 'Collection failed';
                try {
                    const d = await r.json();
                    if (d?.error) errorMsg = d.error;
                } catch {
                    errorMsg = `Server error (${r.status})`;
                }
                throw new Error(errorMsg);
            }
            const d: any = await r.json();
            setSources(d.sources);
            setCheckedAt(d.checkedAt);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Sources unavailable. Baseline retained.');
        } finally {
            setBusy(false);
        }
    }, []);

    useEffect(() => {
        void collect('GET');
        fetch('/api/status')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d && (d as { generation?: string }).generation) {
                    setGeneration((d as { generation: string }).generation);
                }
                if (d && (d as { providers?: any }).providers) {
                    setProviders((d as { providers: any }).providers);
                }
            })
            .catch(() => {});
        const interval = setInterval(() => void collect('GET'), 900000);
        return () => clearInterval(interval);
    }, [collect]);

    const ask = useCallback(async (q: string, t = 'All topics', m = selectedModel) => {
        if (q.trim().length < 3 || q.length > 1500) {
            throw new Error('Ask a question between 3 and 1,500 characters.');
        }
        setQuestion(q);
        setAsked(q);
        setAsking(true);
        setAnswer(null);
        setError('');
        setView('assistant');
        try {
            const r = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: q, topic: t, model: m })
            });
            if (!r.ok) {
                let errorMsg = 'Research request failed';
                try {
                    const d = await r.json();
                    if (d?.error) errorMsg = d.error;
                } catch {
                    errorMsg = `Server error (${r.status})`;
                }
                throw new Error(errorMsg);
            }
            const d: any = await r.json();
            setAnswer(d);
            return d;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Research unavailable');
            throw e;
        } finally {
            setAsking(false);
        }
    }, [selectedModel]);

    const topics = ['All topics', ...Array.from(new Set(sources.map(s => s.topic).filter(Boolean)))];
    const live = sources.filter(s => s.status === 'live').length;
    const shown = sources.filter(s =>
        (topic === 'All topics' || s.topic === topic) &&
        [s.title || '', s.text || '', s.publisher || ''].join(' ').toLowerCase().includes(query.toLowerCase())
    );

    const heading = (title: string, sub: string, eyebrow = 'RESEARCH WORKSPACE') => (
        <div className="page-heading">
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            <p>{sub}</p>
        </div>
    );

    const renderTopicSelector = () => (
        <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="topic-select">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {topics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
        </Select>
    );

    const renderModelSelector = () => (
        <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="model-select">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {AVAILABLE_MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                        {m.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    return (
        <div className="atlas-app-layout">
            {mobileOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={`atlas-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header-box">
                    <button
                        type="button"
                        className="brand-button"
                        onClick={() => switchView('overview')}
                        aria-label="Manufacturing Atlas Home"
                    >
                        <div className="brand-icon"><Layers3 size={24}/></div>
                        <div className="brand-text">
                            ATLAS<span>MANUFACTURING INTELLIGENCE</span>
                        </div>
                    </button>
                </div>

                <div className="sidebar-scrollable">
                    <div className="nav-caption">RESEARCH WORKSPACE</div>
                    <nav className="sidebar-nav-list" aria-label="Sidebar navigation">
                        {nav.map(([id, label, Icon]) => {
                            const isActive = view === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className={`nav-item ${isActive ? 'active' : ''}`}
                                    data-active={isActive ? 'true' : 'false'}
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => switchView(id as any)}
                                >
                                    <Icon size={19}/>
                                    <span>{label}</span>
                                    {isActive && <span className="active-pill" aria-hidden="true" />}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="sidebar-note">
                        <Globe2 size={20}/>
                        <strong>A shared view of the market</strong>
                        <p>Connect technology, market signals, and business decisions.</p>
                    </div>
                </div>

                <div className="sidebar-footer-box">
                    <div className="profile">
                        <span>K</span>
                        <div>Kevin's research workspace<small>Market research</small></div>
                    </div>
                </div>
            </aside>

            <main className="workspace">
                <header className="topbar">
                    <div className="topbar-left">
                        <button
                            type="button"
                            className="mobile-nav-toggle"
                            aria-label="Toggle navigation menu"
                            onClick={() => setMobileOpen(o => !o)}
                        >
                            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <button
                            type="button"
                            className="topbar-crumb-btn"
                            onClick={() => switchView('overview')}
                        >
                            <span className="topbar-title">Advanced manufacturing</span>
                        </button>
                        <ChevronRight size={14} className="topbar-sep"/>
                        <nav className="topbar-tabs" role="tablist" aria-label="Main Navigation">
                            {nav.map(([id, label, Icon]) => {
                                const isActive = view === id;
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        className={`topbar-tab ${isActive ? 'active' : ''}`}
                                        data-active={isActive ? 'true' : 'false'}
                                        onClick={() => switchView(id as any)}
                                    >
                                        <Icon size={15}/>
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                    <span className="demo-label">Independent research demo</span>
                </header>

                {error && (
                    <div className="error-banner" role="alert">
                        <AlertCircle size={17}/>
                        <span>{error}</span>
                    </div>
                )}

                {view === 'overview' && (
                    <Overview
                        setView={(s) => switchView(s as any)}
                        refresh={() => void collect()}
                        busy={busy}
                        checkedAt={checkedAt}
                        live={live}
                    />
                )}

                {view === 'assistant' && (
                    <div className="page">
                        {heading('Research assistant', 'A question is only as useful as the evidence behind its answer.', 'EVIDENCE-BACKED RESEARCH')}
                        <div className="research-layout">
                            <div>
                                <section className="panel question-panel">
                                    <div className="panel-header">
                                        <h2><Sparkles size={19}/> Ask the manufacturing landscape</h2>
                                        <span className="badge">{generation === 'configured' ? 'LLM connected' : 'Retrieval demo'}</span>
                                    </div>
                                    <form onSubmit={e => { e.preventDefault(); void ask(question, topic).catch(() => {}); }}>
                                        <label className="sr-only" htmlFor="question">Research question</label>
                                        <textarea
                                            id="question"
                                            value={question}
                                            onChange={e => setQuestion(e.target.value)}
                                            maxLength={1500}
                                            placeholder="What is changing in additive manufacturing, and why does it matter?"
                                            required
                                            minLength={3}
                                        />
                                        <div className="question-controls">
                                            <div className="selector-group">
                                                {renderTopicSelector()}
                                                {renderModelSelector()}
                                            </div>
                                            <button className="button" disabled={asking || question.trim().length < 3} type="submit">
                                                {asking ? <RefreshCw className="spin" size={16}/> : <Send size={16}/>}
                                                <span>{asking ? 'Researching…' : 'Research'}</span>
                                            </button>
                                        </div>
                                    </form>
                                    <div className="suggestions">
                                        {prompts.map(p => (
                                            <button key={p} type="button" disabled={asking} onClick={() => void ask(p, topic).catch(() => {})}>
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {asking && (
                                    <section className="panel loading-panel" role="status">
                                        <RefreshCw size={22} className="spin"/>
                                        <h2>Retrieving relevant evidence</h2>
                                        <p>Ranking source passages and checking the research context.</p>
                                    </section>
                                )}

                                {answer && (
                                    <section className="panel answer-panel" aria-live="polite">
                                        <div className="panel-header">
                                            <span className="tag">
                                                {answer.mode === 'rag'
                                                    ? `GROUNDED ANALYSIS · ${AVAILABLE_MODELS.find(m => m.id === ((answer.trace as any)?.selectedModel || selectedModel))?.label.split(' (')[0] || 'LLM'}`
                                                    : 'RETRIEVED EVIDENCE'}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-button"
                                                onClick={() => download(
                                                    'atlas-research-brief.md',
                                                    '# ' + asked + '\n\n' + answer.answer + '\n\n## Sources\n' +
                                                    answer.evidence.map(e => '[' + e.number + '] ' + e.title + ' — ' + e.url + '\nFetched: ' + (e.fetchedAt || 'Baseline; no live fetch')).join('\n\n') +
                                                    '\n\n## Retrieval trace\n' + JSON.stringify(answer.trace, null, 2)
                                                )}
                                            >
                                                <Download size={15}/> Export brief
                                            </button>
                                        </div>
                                        <h2>{asked}</h2>
                                        {answer.warning && <p className="notice">{answer.warning}</p>}
                                        <div className="answer-text">{answer.answer}</div>
                                        <Tabs defaultValue="evidence">
                                            <TabsList variant="line">
                                                <TabsTrigger value="evidence">Evidence ({answer.evidence.length})</TabsTrigger>
                                                <TabsTrigger value="trace">Retrieval trace</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="evidence">
                                                <div className="evidence-list">
                                                    {answer.evidence.map(e => (
                                                        <article key={e.number}>
                                                            <div className="citation-number">{e.number}</div>
                                                            <div>
                                                                <a href={e.url} target="_blank" rel="noreferrer">
                                                                    {e.title} <ExternalLink size={12}/>
                                                                </a>
                                                                <p>{e.excerpt}</p>
                                                                <small>{e.publisher} · {e.status === 'live' ? 'Fetched ' + fmt(e.fetchedAt) + ' SGT' : 'Retained baseline / unavailable source'} · {e.method ? e.method.toUpperCase() : 'HYBRID'} score: {e.score}{e.bm25Score !== undefined && e.denseScore !== undefined ? ` (BM25: ${e.bm25Score}, Vector: ${e.denseScore})` : ''}</small>
                                                            </div>
                                                        </article>
                                                    ))}
                                                    {!answer.evidence.length && (
                                                        <p className="empty-message">No matching sources. Broaden the question or topic.</p>
                                                    )}
                                                </div>
                                            </TabsContent>
                                            <TabsContent value="trace">
                                                <pre className="code-block">{JSON.stringify(answer.trace, null, 2)}</pre>
                                                <p className="small-note">Scores rank lexical relevance; they are not confidence probabilities. Source-ID validation does not prove that a claim is supported.</p>
                                            </TabsContent>
                                        </Tabs>
                                    </section>
                                )}
                            </div>

                            <aside>
                                <section className="panel research-context">
                                    <ShieldCheck size={26}/>
                                    <h2>Research with context</h2>
                                    <p>Use the annual baseline to frame questions. Use refreshed sources to investigate developments.</p>
                                    <dl>
                                        <dt>Corpus</dt><dd>{sources.length} source records</dd>
                                        <dt>Current live records</dt><dd>{live}</dd>
                                        <dt>Last collection check</dt><dd>{fmt(checkedAt)} {checkedAt ? 'SGT' : ''}</dd>
                                        <dt>Retrieval</dt><dd>Hybrid (BM25 + Semantic Vectors · RRF)</dd>
                                        <dt>Active Model</dt><dd>{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label.split(' (')[0]}</dd>
                                        <dt>Configured Providers</dt>
                                        <dd>
                                            {[
                                                providers.gemini ? 'Gemini' : null,
                                                providers.huggingface ? 'Hugging Face' : null,
                                                providers.openai ? 'OpenAI' : null
                                            ].filter(Boolean).join(', ') || 'None (Extractive fallback)'}
                                        </dd>
                                    </dl>
                                    <div className="notice">
                                        {generation === 'configured' ? 'Review citations and distinguish facts from interpretation.' : 'This mode returns evidence excerpts. LLM synthesis is available after a server-side API key is configured.'}
                                    </div>
                                </section>
                                <div className="research-tip">
                                    <h3>A useful research question</h3>
                                    <p>“Why might services grow faster than equipment sales, and what data would test that hypothesis?”</p>
                                </div>
                            </aside>
                        </div>
                    </div>
                )}

                {view === 'sources' && (
                    <div className="page">
                        {heading('Sources & insights', 'Inspect the origin, age, and coverage of every research input.', 'THE EVIDENCE LIBRARY')}
                        <div className="source-toolbar">
                            <div className="search-field">
                                <Search size={17}/>
                                <input
                                    aria-label="Search sources"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder="Search titles, publishers, or evidence"
                                />
                            </div>
                            {renderTopicSelector()}
                            <button type="button" className="button" disabled={busy} onClick={() => void collect()}>
                                <RefreshCw size={16} className={busy ? 'spin' : ''}/>
                                <span>{busy ? 'Collecting…' : 'Refresh sources'}</span>
                            </button>
                        </div>
                        <div className="freshness">
                            <span>{shown.length} matching sources · checked {fmt(checkedAt)} {checkedAt ? 'SGT' : ''}</span>
                            <button
                                type="button"
                                className="text-button"
                                onClick={() => download('atlas-source-manifest.json', JSON.stringify({ checkedAt, sources }, null, 2), 'application/json')}
                            >
                                <Download size={15}/> Export corpus
                            </button>
                        </div>
                        <div className="source-grid">
                            {shown.map(s => (
                                <article className="panel source-card" key={s.id}>
                                    <div className="source-top">
                                        <span className="source-publisher">{s.publisher}</span>
                                        <span className={'status ' + s.status}>
                                            {s.status === 'live' ? 'Live fetch' : s.status === 'baseline' ? 'Verified baseline' : 'Fetch unavailable'}
                                        </span>
                                    </div>
                                    <div className="tag">{s.topic}</div>
                                    <h2>
                                        <button type="button" onClick={() => setDetail(s)}>
                                            {s.title}
                                        </button>
                                    </h2>
                                    <p>{s.text.slice(0, 230)}{s.text.length > 230 ? '…' : ''}</p>
                                    <div className="source-bottom">
                                        <span>{s.kind} · {s.date || 'Publication date unknown'}</span>
                                        <button type="button" className="text-button" onClick={() => setDetail(s)}>
                                            Inspect evidence
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                        {!shown.length && (
                            <div className="panel empty-message">No sources match. Try another topic or search term.</div>
                        )}
                        <p className="small-note">
                            Only public pages and Crossref metadata are collected. Displayed passages omit personal and institutional attribution. Licensed Wohlers report content is not included. Live fetch indicates collection time, not the date of the underlying market data.
                        </p>
                    </div>
                )}

                {view === 'pipeline' && (
                    <div className="page">
                        {heading('Data pipeline', 'Follow the data from collection to a traceable research result.', 'METHODS, NOT A BLACK BOX')}
                        <div className="pipeline-steps">
                            {[
                                ['01', 'Collect', Globe2],
                                ['02', 'Normalize', FileJson],
                                ['03', 'Retrieve', Search],
                                ['04', 'Synthesize', Sparkles],
                                ['05', 'Verify', ShieldCheck]
                            ].map(([n, label, Icon]) => (
                                <div key={String(n)}>
                                    <span>{String(n)}</span>
                                    <Icon size={21}/>
                                    <b>{String(label)}</b>
                                </div>
                            ))}
                        </div>
                        <div className="dashboard-grid">
                            <section className="panel">
                                <div className="panel-header">
                                    <h2>Collection health</h2>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <a
                                            href="/notebook/manufacturing_atlas_scraping_pipeline.ipynb"
                                            download="manufacturing_atlas_scraping_pipeline.ipynb"
                                            className="text-button"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                            title="Download Python Jupyter notebook"
                                        >
                                            <Download size={14}/> Scraping Notebook (.ipynb)
                                        </a>
                                        <button type="button" className="text-button" disabled={busy} onClick={() => void collect()}>
                                            <RefreshCw size={14} className={busy ? 'spin' : ''}/>
                                            <span>{busy ? 'Collecting…' : 'Run collection'}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="health-stats">
                                    <div><b>{live}</b><span>Live records</span></div>
                                    <div><b>{sources.filter(s => s.status === 'unavailable').length}</b><span>Unavailable</span></div>
                                    <div><b>{sources.filter(s => s.status === 'baseline').length}</b><span>Baselines</span></div>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Collected</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sources.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell>
                                                    <button type="button" className="source-table-link" onClick={() => setDetail(s)}>
                                                        {s.publisher}
                                                        <small>{s.title}</small>
                                                    </button>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={'status ' + s.status}>{s.status}</span>
                                                </TableCell>
                                                <TableCell className="time-cell">{fmt(s.fetchedAt)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </section>
                            <section className="panel methods">
                                <h2>What this prototype does</h2>
                                <dl>
                                    <dt>Unstructured collection</dt>
                                    <dd>Allowlisted public HTML; robots checks; bounded fetches; article/main extraction; SHA-256 content fingerprints.</dd>
                                    <dt>Structured collection</dt>
                                    <dd>Crossref REST API: titles, publishers, dates, DOI, and abstracts where supplied. Annual market metrics are separately curated.</dd>
                                    <dt>Retrieval</dt>
                                    <dd>Hybrid Sparse (BM25) & Dense Semantic Embeddings combined with Reciprocal Rank Fusion (RRF, k=60), topic filtering, top 6 passages.</dd>
                                    <dt>Generation</dt>
                                    <dd>{generation === 'configured' ? 'Google Gemini API with evidence-only instructions and source-ID citation checks.' : 'Retrieval-only fallback active. Optional Gemini API integration is implemented but unconfigured.'}</dd>
                                    <dt>Freshness & storage</dt>
                                    <dd>Refresh on open, every 15 minutes while open, or manually. Worker memory cache is temporary. There is no background crawler or durable vector database.</dd>
                                    <dt>Limitations</dt>
                                    <dd>Small public corpus, HTML parsing heuristics, no exhaustive market coverage, no independent survey dataset. Bibliographic metadata alone cannot establish research findings.</dd>
                                </dl>
                            </section>
                        </div>
                        <div className="panel" style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#f8faff', border: '1px solid #dbe5f7' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: '#162744' }}>Python Web Scraping & Data Extraction Pipeline</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#60728f' }}>Demo notebook illustrating how Wohlers market release metrics ($24.2B, segments, regional growth), NIST research, and Crossref articles are collected.</p>
                            </div>
                            <a
                                href="/notebook/manufacturing_atlas_scraping_pipeline.ipynb"
                                download="manufacturing_atlas_scraping_pipeline.ipynb"
                                className="button"
                                style={{ textDecoration: 'none' }}
                            >
                                <Download size={15}/> Download Scraping Notebook (.ipynb)
                            </a>
                        </div>
                        <section className="panel quality-panel">
                            <h2>Quality gates for a production pipeline</h2>
                            <div className="quality-grid">
                                <div>
                                    <CheckCircle2 />
                                    <h3>Implemented</h3>
                                    <p>Source allowlist, bounded input and fetches, robots checks, fetch-status visibility, traceable passages, evidence gaps, no-key fallback.</p>
                                </div>
                                <div>
                                    <Clock />
                                    <h3>Next validation</h3>
                                    <p>Labeled question set, recall@k, citation entailment, conflicting-source tests, latency and cost budgets, versioned corpus snapshots.</p>
                                </div>
                                <div>
                                    <Activity />
                                    <h3>Broaden coverage</h3>
                                    <p>Licensed datasets, company filings, patent feeds, standards metadata, analyst review, durable storage, and production access controls.</p>
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {detail && (
                    <div className="source-modal-overlay" onClick={() => setDetail(null)}>
                        <div className="source-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="source-modal-header">
                                <div>
                                    <h2>{detail.title}</h2>
                                    <p>{detail.publisher} · {detail.topic}</p>
                                </div>
                                <button type="button" className="close-btn" aria-label="Close" onClick={() => setDetail(null)}>
                                    <X size={16}/>
                                </button>
                            </div>
                            <div className="sheet-body">
                                <span className={'status ' + detail.status}>{detail.status}</span>
                                <dl>
                                    <dt>Publication date</dt><dd>{detail.date || 'Not established'}</dd>
                                    <dt>Collected</dt><dd>{fmt(detail.fetchedAt)} {detail.fetchedAt ? 'SGT' : ''}</dd>
                                    <dt>Content fingerprint</dt><dd className="hash">{detail.hash || 'Curated baseline; no live fingerprint'}</dd>
                                </dl>
                                {detail.error && <p className="notice">{detail.error}. Retained evidence is shown below.</p>}
                                <a className="button" href={detail.url} target="_blank" rel="noreferrer">
                                    Open original source <ExternalLink size={15}/>
                                </a>
                                <h3>Collected evidence</h3>
                                <p className="source-full-text">{detail.text}</p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
