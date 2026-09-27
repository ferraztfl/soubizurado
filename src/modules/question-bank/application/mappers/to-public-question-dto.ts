import { formatQuestionCode } from "../../domain/question-code";
import type {
  PublicQuestionDto,
  PublicQuestionMediaDto,
} from "../dto/public-question";

import type {
  PublicQuestionMediaRecord,
  PublicQuestionReadRecord,
} from "../ports/public-question-read-repository";

const TEXT_IMAGE = /!\[[^\]\n]*\]\(([^)\s]*)\)/g;

function mediaUrl(mediaAssetId: string): string {
  return `/api/media/${encodeURIComponent(mediaAssetId)}`;
}

function toPublicMediaDto(
  media: PublicQuestionMediaRecord,
): PublicQuestionMediaDto {
  return {
    ...media,
    url: mediaUrl(media.id),
  };
}

function byPosition<T extends { position: number }>(items: readonly T[]): T[] {
  return [...items].sort((first, second) => first.position - second.position);
}

/**
 * Asset ids of the images a text references that have a local copy: those
 * render inside the text, so they are not repeated as attachments.
 */
function referencedAssetIds(
  texts: readonly string[],
  assets: Readonly<Record<string, string>>,
): Set<string> {
  const ids = new Set<string>();

  for (const text of texts) {
    for (const match of text.matchAll(TEXT_IMAGE)) {
      const source = match[1] ?? "";

      if (Object.hasOwn(assets, source)) {
        ids.add(assets[source]!);
      }
    }
  }

  return ids;
}

export function toPublicQuestionDto(
  question: PublicQuestionReadRecord,
): PublicQuestionDto {
  const assets = question.textImageAssets ?? {};
  const supportContents = question.supportContents ?? [];
  const inQuestionText = referencedAssetIds(
    [question.statement, ...supportContents.map((support) => support.content)],
    assets,
  );

  const media = byPosition(question.media ?? [])
    .filter((item) => !inQuestionText.has(item.id))
    .map(toPublicMediaDto);

  const alternatives = byPosition(question.alternatives).map((alternative) => {
    const inAlternativeText = referencedAssetIds([alternative.content], assets);
    const alternativeMedia = byPosition(alternative.media ?? [])
      .filter((item) => !inAlternativeText.has(item.id))
      .map(toPublicMediaDto);

    return {
      id: alternative.id,
      label: alternative.label,
      content: alternative.content,
      position: alternative.position,
      ...(alternativeMedia.length > 0 ? { media: alternativeMedia } : {}),
    };
  });

  return {
    id: question.id,
    code: formatQuestionCode(question.publicNumber),
    type: question.type,
    statement: question.statement,
    supportContents,
    ...(media.length > 0 ? { media } : {}),
    alternatives,

    classification: {
      discipline: question.discipline,
      area: question.area,
      topic: question.topic,
      subtopic: question.subtopic,
    },

    examination: question.examination,

    textImages: Object.fromEntries(
      Object.entries(assets).map(([source, mediaAssetId]) => [source, mediaUrl(mediaAssetId)]),
    ),
  };
}
