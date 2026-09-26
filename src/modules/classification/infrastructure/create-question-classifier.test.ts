import { describe, expect, it } from "vitest";

import {
  createQuestionClassifier,
  readMinimumConfidence,
} from "./create-question-classifier";

describe("createQuestionClassifier", () => {
  it("defaults to the rule-based classifier", () => {
    expect(createQuestionClassifier({}).provider).toBe("rule-based");
  });

  it("builds an openai-compatible classifier from env", () => {
    const classifier = createQuestionClassifier({
      CLASSIFIER_PROVIDER: "openai-compatible",
      CLASSIFIER_API_BASE_URL: "https://api.example.com/v1",
      CLASSIFIER_MODEL: "some-model",
      CLASSIFIER_PROVIDER_LABEL: "gemini",
    });

    expect(classifier).toMatchObject({ provider: "gemini", model: "some-model" });
  });

  it("allows plain http only for local servers", () => {
    expect(
      createQuestionClassifier({
        CLASSIFIER_PROVIDER: "openai-compatible",
        CLASSIFIER_API_BASE_URL: "http://localhost:11434/v1",
        CLASSIFIER_MODEL: "llama",
      }).provider,
    ).toBe("openai-compatible");

    expect(() =>
      createQuestionClassifier({
        CLASSIFIER_PROVIDER: "openai-compatible",
        CLASSIFIER_API_BASE_URL: "http://api.example.com/v1",
        CLASSIFIER_MODEL: "x",
      }),
    ).toThrow("https");
  });

  it("rejects incomplete or unknown configuration", () => {
    expect(() =>
      createQuestionClassifier({ CLASSIFIER_PROVIDER: "openai-compatible" }),
    ).toThrow("required");

    expect(() =>
      createQuestionClassifier({ CLASSIFIER_PROVIDER: "magic" }),
    ).toThrow("Unknown");
  });
});

describe("readMinimumConfidence", () => {
  it("defaults to 0.8 and validates the range", () => {
    expect(readMinimumConfidence({})).toBe(0.8);
    expect(readMinimumConfidence({ CLASSIFIER_MIN_CONFIDENCE: "0.65" })).toBe(0.65);
    expect(() => readMinimumConfidence({ CLASSIFIER_MIN_CONFIDENCE: "2" })).toThrow();
  });
});
