import { describe, expect, it } from "vitest";

import { allowedVideoEmbedUrl, nextLessonId, parseQuestionCodes, planLesson, progressPercent } from "./course";

describe("allowedVideoEmbedUrl", () => {
  it("accepts known players", () => {
    expect(allowedVideoEmbedUrl("https://player-vz-abc123-4d.tv.pandavideo.com.br/embed/?v=xyz")).not.toBeNull();
    expect(allowedVideoEmbedUrl("https://iframe.mediadelivery.net/embed/123/abc")).not.toBeNull();
    expect(allowedVideoEmbedUrl("https://player.vimeo.com/video/76979871")).not.toBeNull();
    expect(allowedVideoEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).not.toBeNull();
  });

  it("rejects anything else", () => {
    expect(allowedVideoEmbedUrl("http://player.vimeo.com/video/1")).toBeNull();
    expect(allowedVideoEmbedUrl("https://evil.example/embed/x")).toBeNull();
    expect(allowedVideoEmbedUrl("https://player.vimeo.com.evil.example/video/1")).toBeNull();
    expect(allowedVideoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(allowedVideoEmbedUrl("https://www.youtube.com/watch?v=abc")).toBeNull();
  });
});

describe("parseQuestionCodes", () => {
  it("reads codes in any format, distinct and in order", () => {
    expect(parseQuestionCodes("Q100001, q100002\n100003 Q100001")).toEqual([100001, 100002, 100003]);
  });
});

describe("planLesson", () => {
  const base = { title: " Aula 1 ", kind: "TEXT", body: "Conteúdo", videoEmbedUrl: "", durationMinutes: "15" };

  it("normalizes a valid lesson", () => {
    expect(planLesson(base)).toEqual({
      ok: true,
      lesson: { title: "Aula 1", kind: "TEXT", body: "Conteúdo", videoEmbedUrl: null, durationMinutes: 15 },
    });
  });

  it("rejects invalid input", () => {
    expect(planLesson({ ...base, title: "x" })).toEqual({ ok: false, error: "TITLE_REQUIRED" });
    expect(planLesson({ ...base, kind: "GAME" })).toEqual({ ok: false, error: "KIND_INVALID" });
    expect(planLesson({ ...base, videoEmbedUrl: "https://evil.example/x" })).toEqual({ ok: false, error: "VIDEO_URL_INVALID" });
    expect(planLesson({ ...base, durationMinutes: "0" })).toEqual({ ok: false, error: "DURATION_INVALID" });
  });
});

describe("progress", () => {
  it("percent and next lesson", () => {
    expect(progressPercent(8, 2)).toBe(25);
    expect(progressPercent(0, 0)).toBe(0);
    expect(nextLessonId(["a", "b", "c"], "b")).toBe("c");
    expect(nextLessonId(["a", "b", "c"], "c")).toBeNull();
  });
});
