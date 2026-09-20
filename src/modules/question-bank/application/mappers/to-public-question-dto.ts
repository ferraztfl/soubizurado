import type {
  PublicQuestionDto,
} from "../dto/public-question";

import type {
  PublicQuestionReadRecord,
} from "../ports/public-question-read-repository";

export function toPublicQuestionDto(
  question: PublicQuestionReadRecord,
): PublicQuestionDto {
  const media =
    [...(question.media ?? [])].sort(
      (first, second) =>
        first.position -
        second.position,
    );

  const alternatives =
    [...question.alternatives]
      .sort(
        (first, second) =>
          first.position -
          second.position,
      )
      .map(
        (alternative) => {
          const alternativeMedia =
            [
              ...(alternative.media ??
                []),
            ].sort(
              (first, second) =>
                first.position -
                second.position,
            );

          return {
            id:
              alternative.id,
            label:
              alternative.label,
            content:
              alternative.content,
            position:
              alternative.position,
            ...(alternativeMedia.length >
            0
              ? {
                  media:
                    alternativeMedia,
                }
              : {}),
          };
        },
      );

  return {
    id:
      question.id,
    type:
      question.type,
    statement:
      question.statement,
    supportContents:
      question.supportContents ??
      [],
    ...(media.length > 0
      ? {
          media,
        }
      : {}),
    alternatives,

    classification: {
      discipline:
        question.discipline,
      area:
        question.area,
      topic:
        question.topic,
      subtopic:
        question.subtopic,
    },

    examination:
      question.examination,
  };
}