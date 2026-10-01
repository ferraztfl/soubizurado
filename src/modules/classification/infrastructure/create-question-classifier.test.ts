import { describe, expect, it } from "vitest";

import {
  createQuestionClassifier,
  readAutoApply,
  readMinimumConfidence,
  readRulesThreshold,
} from "./create-question-classifier";

describe("createQuestionClassifier", () => {
  it("defaults to the rule-based classifier", () => {
    expect(createQuestionClassifier({}).provider).toBe("rule-based");
  });

  it("builds the layered pipeline (rules, then AI) by default", () => {
    const classifier = createQuestionClassifier({
      CLASSIFIER_PROVIDER: "openai-compatible",
      CLASSIFIER_API_BASE_URL: "https://api.example.com/v1",
      CLASSIFIER_MODEL: "some-model",
      CLASSIFIER_PROVIDER_LABEL: "gemini",
    });

    expect(classifier).toMatchObject({
      provider: "layered:gemini",
      model: "some-model",
      version: "lay3:oa-v2:some-model",
    });
  });

  it("adds a local AI layer only for localhost endpoints", () => {
    const base = {
      CLASSIFIER_PROVIDER: "openai-compatible",
      CLASSIFIER_API_BASE_URL: "https://api.example.com/v1",
      CLASSIFIER_MODEL: "gemini-x",
    };

    expect(
      createQuestionClassifier({
        ...base,
        CLASSIFIER_LOCAL_API_BASE_URL: "http://localhost:11434/v1",
        CLASSIFIER_LOCAL_MODEL: "qwen2.5:3b",
      }).version,
    ).toBe("lay4:qwen2.5:3b>gemini-x");

    expect(() =>
      createQuestionClassifier({
        ...base,
        CLASSIFIER_LOCAL_API_BASE_URL: "https://other-host.example/v1",
        CLASSIFIER_LOCAL_MODEL: "x",
      }),
    ).toThrow("localhost");
  });

  it("builds the plain AI classifier when layering is disabled", () => {
    const classifier = createQuestionClassifier({
      CLASSIFIER_PROVIDER: "openai-compatible",
      CLASSIFIER_API_BASE_URL: "https://api.example.com/v1",
      CLASSIFIER_MODEL: "some-model",
      CLASSIFIER_PROVIDER_LABEL: "gemini",
      CLASSIFIER_LAYERED: "false",
    });

    expect(classifier).toMatchObject({ provider: "gemini", version: "oa-v2:some-model" });
  });

  it("allows plain http only for local servers", () => {
    expect(
      createQuestionClassifier({
        CLASSIFIER_PROVIDER: "openai-compatible",
        CLASSIFIER_API_BASE_URL: "http://localhost:11434/v1",
        CLASSIFIER_MODEL: "llama",
      }).provider,
    ).toBe("layered:openai-compatible");

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

describe("pipeline settings", () => {
  it("reads the rules threshold and the auto-apply switch", () => {
    expect(readRulesThreshold({})).toBe(0.8);
    expect(readRulesThreshold({ CLASSIFIER_RULES_THRESHOLD: "0.7" })).toBe(0.7);
    expect(() => readRulesThreshold({ CLASSIFIER_RULES_THRESHOLD: "-1" })).toThrow();
    expect(readAutoApply({})).toBe(true);
    expect(readAutoApply({ CLASSIFIER_AUTO_APPLY: "false" })).toBe(false);
  });
});

describe("readMinimumConfidence", () => {
  it("defaults to 0.8 and validates the range", () => {
    expect(readMinimumConfidence({})).toBe(0.8);
    expect(readMinimumConfidence({ CLASSIFIER_MIN_CONFIDENCE: "0.65" })).toBe(0.65);
    expect(() => readMinimumConfidence({ CLASSIFIER_MIN_CONFIDENCE: "2" })).toThrow();
  });

  it("keeps the previous versions when the similar-questions layer is turned off", () => {
    const env = {
      CLASSIFIER_PROVIDER: "openai-compatible",
      CLASSIFIER_API_BASE_URL: "https://example.com/v1",
      CLASSIFIER_MODEL: "some-model",
      CLASSIFIER_SIMILAR: "false",
    };

    expect(createQuestionClassifier(env).version).toBe("lay1:oa-v2:some-model");
  });
});
