# Manufacturing Atlas

An independent advanced manufacturing research application inspired by Wohlers' public market intelligence approach. Not affiliated with Wohlers Associates.

## Included

- Dated 2025 market dashboard with primary-source attribution, revenue share chart, and regional company-growth comparisons.
- Live public HTML collection from allowlisted Wohlers and NIST pages, robots checks, bounded fetches, status/error visibility, and content fingerprints.
- Structured Crossref REST discovery with DOI, publication metadata, relevant-title filtering, and abstract collection when provided.
- Topic-filtered BM25 retrieval over 220-word chunks with 50-word overlap, evidence excerpts, retrieval trace, and Markdown brief export.
- Optional OpenAI Responses API generation with supplied-evidence instructions, abstention, source-ID validation, and retrieval fallback.
- Inspectable source manifest and JSON export.
- Responsive UI and page-scoped WebMCP research/refresh actions.

## Run locally

Requires Node >=22.13 and npm.

```sh
npm run install:ci
npm run dev
```

Configure the optional LLM connection with server-side environment variables:

```
OPENAI_API_KEY=<server-side secret>
OPENAI_MODEL=gpt-4.1-mini
```

Copy `.env.example` to `.env` for local configuration. Never put an API key in browser code or commit it. Hosted keys must be configured as Sites secrets before deployment. Install the OpenAI Developers plugin to provision a key through its approval workflow.

## API

- `GET /api/sources`: collect on first request or after a 15-minute cache expiration.
- `POST /api/sources`: manual refresh; 60-second cooldown per Worker isolate.
- `GET /api/status`: generation configuration status and current corpus.
- `POST /api/chat`: JSON `{ "question": "...", "topic": "All topics" }`; returns evidence, mode, answer, and retrieval trace. Requests are limited to 1,500 question characters.

Sources refresh when opened and every 15 minutes while the page is open. Worker memory is temporary and may reset. There is no background scheduler, durable corpus database, user-upload store, or vector database. Refresh does not change dated annual market figures. A live collection timestamp does not make the underlying data current.

## Methodology and boundaries

Market baseline: the public [Wohlers 2026 release](https://wohlersassociates.com/press-releases/new-wohlers-report-2026-values-additive-manufacturing-market-at-24-2b/). Revenue and growth refer to 2025. Regional figures are average company revenue growth, not market shares. Full respondent coverage and methodology are not available in this public corpus.

The HTML parser is a lightweight heuristic, not a full browser extractor. Public index summaries do not establish access to report bodies. No paid content is bypassed. Crossref metadata is bibliographic; records without abstracts do not establish study findings.

Without a key, the assistant returns relevant excerpts and labels itself retrieval-only. No embeddings, LLM training, or fine-tuning are performed. Citation checks validate source identifiers, not factual entailment. In production, add semantic retrieval, durable versioned source storage, per-user access controls and rate limits, licensed sources, a labeled evaluation dataset, citation entailment checks, and human analyst review.
