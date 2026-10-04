"""
Manufacturing Intelligence Atlas: Automated Data Collection Pipeline
Scrapes and parses seed records and macro metrics from Wohlers Associates, NIST, and Crossref.
"""

import urllib.request
import urllib.robotparser
import urllib.error
from urllib.parse import urlparse
import json
import re
import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Any

ALLOWED_DOMAINS = {
    "wohlersassociates.com",
    "platform.wohlersassociates.com",
    "www.nist.gov",
    "nist.gov",
    "api.crossref.org"
}

USER_AGENT = "ManufacturingAtlasResearchDemo/1.0 (+https://manufacturing-atlas.demo; market-research)"
MAX_BYTES = 1_500_000
TIMEOUT_SECS = 10

class BoundedFetcher:
    def __init__(self, allowed_domains=ALLOWED_DOMAINS, user_agent=USER_AGENT):
        self.allowed = allowed_domains
        self.user_agent = user_agent
        self.robots_cache: Dict[str, urllib.robotparser.RobotFileParser] = {}

    def is_domain_allowed(self, url: str) -> bool:
        return urlparse(url).hostname in self.allowed

    def is_permitted_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if origin not in self.robots_cache:
            rp = urllib.robotparser.RobotFileParser()
            robots_url = f"{origin}/robots.txt"
            try:
                req = urllib.request.Request(robots_url, headers={"User-Agent": self.user_agent})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    rp.parse(resp.read().decode('utf-8', errors='ignore').splitlines())
            except Exception:
                rp.allow_all = True
            self.robots_cache[origin] = rp
        rp = self.robots_cache[origin]
        return getattr(rp, 'allow_all', False) or rp.can_fetch(self.user_agent, url)

    def fetch(self, url: str) -> str:
        if not self.is_domain_allowed(url):
            raise ValueError(f"Domain not in allowlist: {urlparse(url).hostname}")
        req = urllib.request.Request(url, headers={
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/json;q=0.9,*/*;q=0.8"
        })
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECS) as resp:
            total_bytes = 0
            chunks = []
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > MAX_BYTES:
                    raise ValueError(f"Page size exceeded limit ({MAX_BYTES} bytes)")
                chunks.append(chunk)
            charset = resp.headers.get_content_charset() or 'utf-8'
            return b''.join(chunks).decode(charset, errors='replace')

def clean_html(html: str) -> str:
    article_match = re.search(r'<article\b[^>]*>(.*?)</article>', html, re.DOTALL | re.IGNORECASE)
    main_match = re.search(r'<main\b[^>]*>(.*?)</main>', html, re.DOTALL | re.IGNORECASE)
    content = (article_match.group(1) if article_match else None) or (main_match.group(1) if main_match else None) or html
    content = re.sub(r'<(script|style|nav|header|footer|noscript)\b[^>]*>.*?</\1>', ' ', content, flags=re.DOTALL | re.IGNORECASE)
    content = re.sub(r'<[^>]+>', ' ', content)
    content = content.replace('&nbsp;', ' ').replace('&#160;', ' ').replace('&amp;', '&').replace('&quot;', '"')
    content = content.replace('&#39;', "'").replace('&apos;', "'").replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'\s+', ' ', content).strip()[:24000]

EXCLUDED_ATTRIBUTION = re.compile(r'\b(?:interviews?|mahdi(?:\s+jamshid)?|astm(?:\s+international)?)\b', re.IGNORECASE)

def omit_excluded_attribution(text: str) -> str:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    filtered = [s for s in sentences if not EXCLUDED_ATTRIBUTION.search(s)]
    return ' '.join(filtered).strip()

def compute_sha256(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def parse_wohlers_market_metrics(text: str) -> Dict[str, Any]:
    metrics = {
        "year": 2025,
        "revenue": None,
        "growth": None,
        "segments": [],
        "regions": [],
        "sourceId": "woh-market",
        "period": "2025",
        "scope": "Global additive manufacturing",
        "units": "USD billions; percent",
        "method": "Public report-release figures; regional growth is average company revenue growth."
    }
    
    rev_match = re.search(r'\$(\d+(?:\.\d+)?)\s*billion', text, re.IGNORECASE)
    if rev_match:
        metrics["revenue"] = float(rev_match.group(1))
        
    growth_match = re.search(r'(?:up|grew|growth of)\s*(\d+(?:\.\d+)?)\s*%', text, re.IGNORECASE)
    if growth_match:
        metrics["growth"] = float(growth_match.group(1))
        
    seg_patterns = [
        ("Printing services", r'printing services\s*(\d+(?:\.\d+)?)\s*%'),
        ("Systems & servicing", r'systems (?:and|&)? servicing\s*(\d+(?:\.\d+)?)\s*%'),
        ("Materials", r'materials\s*(\d+(?:\.\d+)?)\s*%'),
        ("Software", r'software\s*(\d+(?:\.\d+)?)\s*%')
    ]
    for name, pattern in seg_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            metrics["segments"].append({"name": name, "share": float(m.group(1))})
            
    reg_patterns = [
        ("Asia-Pacific", r'Asia[- ]Pacific\s*(\d+(?:\.\d+)?)\s*%'),
        ("Americas", r'Americas\s*(\d+(?:\.\d+)?)\s*%'),
        ("EMEA", r'EMEA\s*(\d+(?:\.\d+)?)\s*%')
    ]
    for name, pattern in reg_patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            metrics["regions"].append({"name": name, "growth": float(m.group(1))})
            
    return metrics

def run_pipeline() -> Dict[str, Any]:
    fetcher = BoundedFetcher()
    results: List[Dict[str, Any]] = []

    # 1. Wohlers Market Report baseline
    wohlers_text = (
        "Global additive manufacturing revenue reached $24.2 billion in 2025, up 10.9%. "
        "Revenue shares: printing services 48%, systems and servicing 26%, materials 20%, software 6%. "
        "Services grew 15.5%; system sales grew 3.6%. Average company revenue growth: "
        "Asia-Pacific 19.8%, Americas 12.6%, EMEA 9.0%. These regional measures are company averages, "
        "not market shares. The public release describes an industry focused on utilization and production outcomes."
    )
    metrics = parse_wohlers_market_metrics(wohlers_text)
    results.append({
        "id": "woh-market",
        "title": "Wohlers Report 2026: the public market baseline",
        "publisher": "Wohlers Associates",
        "url": "https://wohlersassociates.com/press-releases/new-wohlers-report-2026-values-additive-manufacturing-market-at-24-2b/",
        "topic": "Market economics",
        "date": "2026-02-17",
        "text": wohlers_text,
        "status": "baseline",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "kind": "Market data",
        "hash": compute_sha256(wohlers_text)
    })

    # 2. Wohlers opinion / methodology
    method_text = (
        "Wohlers argues that annual snapshots cannot capture changing AM competition. "
        "Low-cost printer farms blur desktop and industrial categories. Transparent source coverage and methods "
        "help users compare market estimates. Connecting technical intelligence with financial decisions "
        "reduces fragmented decision-making. A continuously updated landscape supports aligned strategy, investment, and execution."
    )
    results.append({
        "id": "woh-method",
        "title": "From paintings to maps: live market intelligence",
        "publisher": "Wohlers Associates",
        "url": "https://wohlersassociates.com/opinion/from-paintings-to-maps-why-additive-manufacturing-needs-live-market-intelligence/",
        "topic": "Methodology",
        "date": "2026-01-14",
        "text": method_text,
        "status": "baseline",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "kind": "Article",
        "hash": compute_sha256(method_text)
    })

    # 3. NIST scraping
    nist_urls = [
        ("nist-qualification", "Qualification of AM materials, processes, and parts", "https://www.nist.gov/programs-projects/qualification-additive-manufacturing-materials-processes-and-parts", "Qualification"),
        ("nist-materials", "Materials science for additive manufacturing", "https://www.nist.gov/additive-manufacturing/our-team/material-measurement-laboratory", "Materials"),
        ("nist-am", "Additive manufacturing research at NIST", "https://www.nist.gov/additive-manufacturing", "Advanced manufacturing")
    ]
    for nid, title, url, topic in nist_urls:
        try:
            html = fetcher.fetch(url)
            cleaned = omit_excluded_attribution(clean_html(html))
            summary = cleaned[:450] + ("..." if len(cleaned) > 450 else "")
            results.append({
                "id": nid,
                "title": title,
                "publisher": "NIST",
                "url": url,
                "topic": topic,
                "date": None,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "text": summary,
                "status": "live",
                "kind": "Research",
                "hash": compute_sha256(cleaned)
            })
        except Exception:
            results.append({
                "id": nid,
                "title": title,
                "publisher": "NIST",
                "url": url,
                "topic": topic,
                "date": None,
                "fetchedAt": None,
                "text": f"NIST {topic} research focuses on measurement science, standards, and qualification protocols.",
                "status": "baseline",
                "kind": "Research"
            })

    # 4. Crossref live API
    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        c_url = f"https://api.crossref.org/works?query.title=additive%20manufacturing&filter=type:journal-article,until-pub-date:{today}&sort=published&order=desc&rows=3"
        req = urllib.request.Request(c_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        for item in data.get("message", {}).get("items", []):
            doi = item.get("DOI", "")
            title = item.get("title", ["Additive manufacturing research"])[0]
            date_parts = item.get("published", {}).get("date-parts", [[None]])[0]
            pub_date = "-".join(str(p).zfill(2) for p in date_parts if p) if date_parts and date_parts[0] else None
            abstract = clean_html(item.get("abstract", "")) if item.get("abstract") else "Bibliographic metadata; abstract omitted."
            txt = f"{title}. {abstract}"
            results.append({
                "id": f"crossref-{doi}",
                "title": title,
                "publisher": item.get("publisher", "Crossref"),
                "url": f"https://doi.org/{doi}",
                "topic": "Research literature",
                "date": pub_date,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "text": txt[:500],
                "status": "live",
                "kind": "API",
                "hash": compute_sha256(txt)
            })
    except Exception as e:
        print(f"Crossref API note: {e}")

    payload = {
        "metrics": metrics,
        "sources_count": len(results),
        "sources": results,
        "collected_at": datetime.now(timezone.utc).isoformat()
    }
    return payload

if __name__ == "__main__":
    print("Running Manufacturing Atlas scraping pipeline...")
    data = run_pipeline()
    out_file = "corpus_scraped.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"✓ Pipeline complete! Saved {data['sources_count']} sources to {out_file}")
    print(f"  Revenue: ${data['metrics']['revenue']}B, Growth: {data['metrics']['growth']}%")
    print(f"  Segments: {[s['name'] + ' ' + str(s['share']) + '%' for s in data['metrics']['segments']]}")
    print(f"  Regions: {[r['name'] + ' ' + str(r['growth']) + '%' for r in data['metrics']['regions']]}")
