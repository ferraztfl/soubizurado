import { describe, expect, it } from "vitest";

import {
  encodeSubtopicChoice,
  encodeTopicChoice,
  parseQuestionClassificationChoice,
} from "./question-classification-choice";

const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("parseQuestionClassificationChoice", () => {
  it("round-trips topic and subtopic choices", () => {
    expect(
      parseQuestionClassificationChoice(encodeTopicChoice(id)),
    ).toEqual({ kind: "topic", topicId: id });

    expect(
      parseQuestionClassificationChoice(encodeSubtopicChoice(id)),
    ).toEqual({ kind: "subtopic", subtopicId: id });
  });

  it("rejects empty, unknown or malformed values", () => {
    for (const value of [
      null,
      "",
      "topic:",
      "topic:not-a-uuid",
      `area:${id}`,
      id,
    ]) {
      expect(parseQuestionClassificationChoice(value)).toBeNull();
    }
  });
});
