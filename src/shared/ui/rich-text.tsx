import { Fragment } from "react";

import { parseInlineMarkdown, type InlineImageMap } from "./inline-markdown";

import { TextImage } from "./text-image";

type RichTextProps = Readonly<{
  text: string;
  /**
   * Imported image source URL → local copy. Mapped images render where
   * they appear in the text (symbols inline, figures as blocks).
   */
  images?: InlineImageMap;
}>;

/**
 * Renders imported question text with safe inline formatting (bold,
 * italic, http links, mapped images). Newlines are preserved as text, so
 * the parent should use `white-space: pre-line`. Works in server and
 * client components.
 */
export function RichText({ text, images }: RichTextProps) {
  return (
    <>
      {parseInlineMarkdown(text, images).map((node, index) => {
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

        if (node.type === "image") {
          return <TextImage key={index} src={node.src} alt={node.alt} inline={node.inline} />;
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
