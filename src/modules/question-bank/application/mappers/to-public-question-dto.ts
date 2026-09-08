import type {
  PublicQuestionDto,
} from "../dto/public-question";

import type {
  PublishedQuestionRecord,
} from "../ports/question-repository";

export function toPublicQuestionDto(
  question: PublishedQuestionRecord,
): PublicQuestionDto {
  const alternatives = [...question.alternatives]
    .sort(
      (first, second) =>
        first.position - second.position,
    )
    .map((alternative) => ({
      id: alternative.id,
      label: alternative.label,
      content: alternative.content,
      position: alternative.position,
    }));

  return {
    id: question.id,
    type: question.type,
    statement: question.statement,
    alternatives,

    classification: {
      discipline: question.discipline,
      area: question.area,
      topic: question.topic,
      subtopic: question.subtopic,
    },

    examination: question.examination,
  };
}
