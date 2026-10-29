import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A deliberately small Markdown subset renderer for CMS-authored long-form
 * text (privacy policy, booking terms).
 *
 * It supports headings, paragraphs, lists, bold and inline code — which is
 * everything the legal templates use — and nothing else. Importing a full
 * Markdown pipeline to render two static documents would add a parser, a
 * sanitiser and their transitive dependencies to the bundle for no gain.
 *
 * Crucially, it never produces raw HTML: every node is a React element built
 * from parsed text, so a `<script>` typed into the admin editor renders as
 * the literal characters rather than executing.
 */
export function Prose({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn('max-w-prose space-y-5', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2
                key={index}
                className="mt-10 font-display text-2xl text-chocolate-800 first:mt-0"
              >
                {renderInline(block.text)}
              </h2>
            );
          case 'h3':
            return (
              <h3
                key={index}
                className="mt-7 font-display text-xl text-chocolate-800"
              >
                {renderInline(block.text)}
              </h3>
            );
          case 'ul':
            return (
              <ul
                key={index}
                className="list-disc space-y-1.5 pl-5 text-base leading-relaxed text-brown-400 marker:text-brown-300"
              >
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={index} className="text-base leading-relaxed text-brown-400">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

type Block =
  | { type: 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] };

function parseBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  const chunks = input.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      blocks.push({ type: 'h3', text: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ type: 'h2', text: trimmed.slice(3) });
    } else if (/^[-*] /m.test(trimmed) && trimmed.split('\n').every((l) => /^[-*] /.test(l.trim()))) {
      blocks.push({
        type: 'ul',
        items: trimmed.split('\n').map((line) => line.trim().replace(/^[-*] /, '')),
      });
    } else {
      blocks.push({ type: 'p', text: trimmed });
    }
  }

  return blocks;
}

/** Handles `**bold**` and `` `code` `` only. Everything else stays literal. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-medium text-chocolate-800">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code key={key++} className="rounded bg-sand-200 px-1 py-0.5 text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
