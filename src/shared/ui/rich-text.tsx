import { Fragment } from "react";

import { parseInlineMarkdown } from "./inline-markdown";

type RichTextProps = Readonly<{
  text: string;
}>;

/**
 * Renders imported question text with safe inline formatting (bold,
 * italic, http links). Newlines are preserved as text, so the parent
 * should use `white-space: pre-line`. Works in server and client
 * components.
 */
export function RichText({ text }: RichTextProps) {
  return (
    <>
      {parseInlineMarkdown(text).map((node, index) => {
        if (node.type === "link") {
          return (
            <a
              key={index}
              href={node.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              {node.label}
            </a>
          );
        }

        let content = <Fragment>{node.value}</Fragment>;

        if (node.italic) {
          content = <em>{content}</em>;
        }

        if (node.bold) {
          content = <strong>{content}</strong>;
        }

        return <Fragment key={index}>{content}</Fragment>;
      })}
    </>
  );
}
