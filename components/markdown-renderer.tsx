'use client';

import React from 'react';

interface MarkdownRendererProps {
    content: string;
    className?: string;
    onCitationClick?: (citationNum: number) => void;
}

/**
 * Parses inline markdown:
 * - Bold + Italic: ***text*** or ___text___
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Inline Code: `code`
 * - Strikethrough: ~~text~~
 * - Links: [text](url)
 * - Citation Badges: [1], [2], [1, 2], [1][2]
 */
function renderInlineText(text: string, onCitationClick?: (n: number) => void): React.ReactNode[] {
    // Regex matching tokens in priority order
    // 1. Citation badges: \[(\d+(?:,\s*\d+)*)\]
    // 2. Bold+Italic: (\*\*\*|___)(.*?)\1
    // 3. Bold: (\*\*|__)(.*?)\1
    // 4. Italic: (\*|_)(.*?)\1
    // 5. Inline Code: `([^`]+)`
    // 6. Strikethrough: ~~([^~]+)~~
    // 7. Links: \[([^\]]+)\]\(([^)]+)\)
    const tokenRegex = /(\[(\d+(?:\s*,\s*\d+)*)\])|(\*\*\*(.+?)\*\*\*|___(.+?)___)|(\*\*(.+?)\*\*|__(.+?)__)|(?<!\w)(\*(?!\s)([^*]+?)(?<!\s)\*|_(?!\s)([^_]+?)(?<!\s)_)(?!\w)|(`([^`]+)`)|(~~(.+?)~~)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g;

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let keyCounter = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
        // Add plain text preceding this match
        if (match.index > lastIndex) {
            elements.push(text.substring(lastIndex, match.index));
        }

        const [
            fullMatch,
            citationMatch, citationNums,
            boldItalicMatch, bi1, bi2,
            boldMatch, b1, b2,
            italicMatch, i1, i2,
            codeMatch, codeContent,
            strikeMatch, strikeContent,
            linkMatch, linkText, linkUrl
        ] = match;

        if (citationMatch && citationNums) {
            // Check if this looks like a citation [1] or [1, 2]
            const nums = citationNums.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            elements.push(
                <span key={`cite-${keyCounter++}`} className="citation-group">
                    {nums.map((n, idx) => (
                        <button
                            key={`pill-${n}-${idx}`}
                            type="button"
                            className="citation-pill"
                            title={`Citation [${n}] - View Evidence`}
                            onClick={() => onCitationClick?.(n)}
                        >
                            [{n}]
                        </button>
                    ))}
                </span>
            );
        } else if (boldItalicMatch) {
            const inner = bi1 || bi2 || '';
            elements.push(
                <strong key={`bi-${keyCounter++}`}>
                    <em>{renderInlineText(inner, onCitationClick)}</em>
                </strong>
            );
        } else if (boldMatch) {
            const inner = b1 || b2 || '';
            elements.push(
                <strong key={`b-${keyCounter++}`}>
                    {renderInlineText(inner, onCitationClick)}
                </strong>
            );
        } else if (italicMatch) {
            const inner = i1 || i2 || '';
            elements.push(
                <em key={`i-${keyCounter++}`}>
                    {renderInlineText(inner, onCitationClick)}
                </em>
            );
        } else if (codeMatch) {
            elements.push(
                <code key={`c-${keyCounter++}`} className="inline-code">
                    {codeContent}
                </code>
            );
        } else if (strikeMatch) {
            elements.push(
                <del key={`s-${keyCounter++}`}>
                    {strikeContent}
                </del>
            );
        } else if (linkMatch) {
            elements.push(
                <a
                    key={`l-${keyCounter++}`}
                    href={linkUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="md-link"
                >
                    {linkText}
                </a>
            );
        } else {
            elements.push(fullMatch);
        }

        lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
    }

    return elements;
}

export function MarkdownRenderer({ content, className = '', onCitationClick }: MarkdownRendererProps) {
    if (!content) return null;

    // Normalize Windows line endings
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    const blocks: React.ReactNode[] = [];
    let i = 0;
    let blockKey = 0;

    while (i < lines.length) {
        const line = lines[i];

        // 1. Code Block (```lang ... ```)
        if (line.trim().startsWith('```')) {
            const lang = line.trim().slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++; // consume closing ```
            blocks.push(
                <pre key={`code-${blockKey++}`} className="code-block" data-lang={lang || undefined}>
                    <code>{codeLines.join('\n')}</code>
                </pre>
            );
            continue;
        }

        // 2. Headings (# H1, ## H2, ### H3, #### H4)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingText = headingMatch[2];
            const children = renderInlineText(headingText, onCitationClick);

            switch (level) {
                case 1:
                    blocks.push(<h1 key={`h1-${blockKey++}`}>{children}</h1>);
                    break;
                case 2:
                    blocks.push(<h2 key={`h2-${blockKey++}`}>{children}</h2>);
                    break;
                case 3:
                    blocks.push(<h3 key={`h3-${blockKey++}`}>{children}</h3>);
                    break;
                case 4:
                default:
                    blocks.push(<h4 key={`h4-${blockKey++}`}>{children}</h4>);
                    break;
            }
            i++;
            continue;
        }

        // 3. Blockquote (> quote)
        if (line.trim().startsWith('>')) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push(
                <blockquote key={`quote-${blockKey++}`}>
                    {quoteLines.map((ql, qidx) => (
                        <p key={`qp-${qidx}`}>{renderInlineText(ql, onCitationClick)}</p>
                    ))}
                </blockquote>
            );
            continue;
        }

        // 4. Unordered List (*, -, +)
        if (/^\s*[-*+]\s+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
                i++;
            }
            blocks.push(
                <ul key={`ul-${blockKey++}`}>
                    {listItems.map((item, idx) => (
                        <li key={`li-${idx}`}>{renderInlineText(item, onCitationClick)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        // 5. Ordered List (1. , 2. )
        if (/^\s*\d+\.\s+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
                i++;
            }
            blocks.push(
                <ol key={`ol-${blockKey++}`}>
                    {listItems.map((item, idx) => (
                        <li key={`oli-${idx}`}>{renderInlineText(item, onCitationClick)}</li>
                    ))}
                </ol>
            );
            continue;
        }

        // 6. Horizontal Rule (---, ***, ___)
        if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
            blocks.push(<hr key={`hr-${blockKey++}`} />);
            i++;
            continue;
        }

        // 7. Empty line
        if (line.trim() === '') {
            i++;
            continue;
        }

        // 8. Regular Paragraph (accumulate lines until blank line or special block)
        const paraLines: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !lines[i].trim().startsWith('```') &&
            !lines[i].match(/^#{1,6}\s+/) &&
            !lines[i].trim().startsWith('>') &&
            !/^\s*[-*+]\s+/.test(lines[i]) &&
            !/^\s*\d+\.\s+/.test(lines[i]) &&
            !/^(\*{3,}|-{3,}|_{3,})$/.test(lines[i].trim())
        ) {
            paraLines.push(lines[i]);
            i++;
        }

        if (paraLines.length > 0) {
            const textContent = paraLines.join('\n');
            blocks.push(
                <p key={`p-${blockKey++}`}>
                    {renderInlineText(textContent, onCitationClick)}
                </p>
            );
        }
    }

    return (
        <div className={`markdown-content ${className}`}>
            {blocks}
        </div>
    );
}
