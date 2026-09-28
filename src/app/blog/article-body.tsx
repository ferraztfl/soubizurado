import { parseArticleBlocks } from "@/modules/blog/domain/blog";
import { RichText } from "@/shared/ui/rich-text";

import styles from "./portal.module.css";

/**
 * Renders an article from its safe Markdown subset. Text always goes
 * through RichText (escaped; bold, italic and http links only).
 */
export function ArticleBody({ body, images }: Readonly<{ body: string; images: ReadonlyMap<number, string> }>) {
  return (
    <div className={styles.article}>
      {parseArticleBlocks(body).map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={index}>
                <RichText text={block.text} />
              </h2>
            ) : (
              <h3 key={index}>
                <RichText text={block.text} />
              </h3>
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <RichText text={item} />
              </li>
            ));
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          case "quote":
            return (
              <blockquote key={index}>
                <RichText text={block.text} />
              </blockquote>
            );
          case "callout":
            return (
              <aside key={index} className={`${styles.callout} ${styles[`callout_${block.kind}`] ?? ""}`}>
                {block.title ? (
                  <strong className={styles.calloutTitle}>
                    <RichText text={block.title} />
                  </strong>
                ) : null}
                {block.lines.some((line) => line.type === "item") ? (
                  <ul>
                    {block.lines.map((line, lineIndex) =>
                      line.type === "item" ? (
                        <li key={lineIndex}>
                          <RichText text={line.text} />
                        </li>
                      ) : null,
                    )}
                  </ul>
                ) : null}
                {block.lines.map((line, lineIndex) =>
                  line.type === "text" ? (
                    <p key={lineIndex}>
                      <RichText text={line.text} />
                    </p>
                  ) : line.type === "button" ? (
                    <a key={lineIndex} href={line.href} target="_blank" rel="noopener noreferrer nofollow" className={styles.calloutButton}>
                      {line.label}
                    </a>
                  ) : null,
                )}
              </aside>
            );
          case "table":
            return (
              <div key={index} className={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col">
                          <RichText text={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>
                            <RichText text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "image": {
            const src = images.get(block.index);
            return src ? (
              <figure key={index}>
                {/* eslint-disable-next-line @next/next/no-img-element -- protected media route */}
                <img src={src} alt="" loading="lazy" decoding="async" />
              </figure>
            ) : null;
          }
          default:
            return (
              <p key={index}>
                <RichText text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
