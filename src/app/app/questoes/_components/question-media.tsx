/* eslint-disable @next/next/no-img-element */

import type {
  PublicQuestionMediaDto,
} from "@/modules/question-bank/application/dto/public-question";

import styles from "./question-media.module.css";

type QuestionMediaProps =
  Readonly<{
    media?:
      readonly PublicQuestionMediaDto[];
    variant?:
      | "default"
      | "compact"
      | "alternative";
    allowDocumentLinks?: boolean;
    fallbackAlt?: string;
  }>;

function mediaLabel(
  media: PublicQuestionMediaDto,
  fallback: string,
): string {
  return (
    media.altText?.trim() ||
    fallback
  );
}

export function QuestionMedia({
  media,
  variant = "default",
  allowDocumentLinks = true,
  fallbackAlt = "Imagem da questao",
}: QuestionMediaProps) {
  if (
    !media ||
    media.length === 0
  ) {
    return null;
  }

  const className = [
    styles.list,
    variant === "compact"
      ? styles.compact
      : "",
    variant === "alternative"
      ? styles.alternative
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={className}>
      {media.map(
        (item) => {
          if (
            item.mimeType.startsWith(
              "image/",
            )
          ) {
            return (
              <span
                key={item.id}
                className={
                  styles.item
                }
              >
                <img
                  src={item.url}
                  alt={mediaLabel(
                    item,
                    fallbackAlt,
                  )}
                  width={
                    item.width ??
                    undefined
                  }
                  height={
                    item.height ??
                    undefined
                  }
                  loading="lazy"
                  decoding="async"
                  className={
                    styles.image
                  }
                />
              </span>
            );
          }

          const isPdf =
            item.mimeType ===
            "application/pdf";

          const label =
            mediaLabel(
              item,
              isPdf
                ? "Material em PDF"
                : "Anexo da questao",
            );

          if (
            !allowDocumentLinks
          ) {
            return (
              <span
                key={item.id}
                className={
                  styles.document
                }
              >
                {label}
              </span>
            );
          }

          return (
            <span
              key={item.id}
              className={
                styles.item
              }
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  styles.documentLink
                }
              >
                {isPdf
                  ? "Abrir material em PDF"
                  : "Abrir anexo"}
              </a>
            </span>
          );
        },
      )}
    </span>
  );
}
