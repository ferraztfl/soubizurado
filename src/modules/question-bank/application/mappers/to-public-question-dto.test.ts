import { describe, expect, it } from "vitest";

import type { PublicQuestionReadRecord } from "../ports/public-question-read-repository";

import { toPublicQuestionDto } from "./to-public-question-dto";

const media = (id: string, position: number) => ({
  id,
  mimeType: "image/png",
  width: null,
  height: null,
  altText: null,
  position,
});

const record: PublicQuestionReadRecord = {
  id: "question-1",
  publicNumber: 102816,
  type: "MULTIPLE_CHOICE",
  statement: "Qual é o dígito N5?",
  supportContents: [
    { id: "support-1", content: "S = 5 ![](https://src/n1.jpg) + 4 ![](https://src/n2.jpg)", position: 0 },
  ],
  media: [media("asset-n1", 0), media("asset-n2", 1), media("asset-figure", 2)],
  alternatives: [
    { id: "alt-a", label: "A", content: "![](https://src/a.jpg)", position: 0, media: [media("asset-a", 0)] },
    { id: "alt-b", label: "B", content: "7", position: 1, media: [media("asset-b", 0)] },
  ],
  discipline: { id: "d", name: "Matemática" },
  area: null,
  topic: { id: "t", name: "Aritmética" },
  subtopic: null,
  examination: null,
  textImageAssets: {
    "https://src/n1.jpg": "asset-n1",
    "https://src/n2.jpg": "asset-n2",
    "https://src/a.jpg": "asset-a",
  },
};

describe("toPublicQuestionDto", () => {
  it("maps text images to local URLs and does not repeat them as attachments", () => {
    const dto = toPublicQuestionDto(record);

    expect(dto.code).toBe("Q102816");
    expect(dto.textImages["https://src/n1.jpg"]).toBe("/api/media/asset-n1");
    expect(dto.media?.map((item) => item.id)).toEqual(["asset-figure"]);
    expect(dto.alternatives[0]?.media).toBeUndefined();
    expect(dto.alternatives[1]?.media?.map((item) => item.id)).toEqual(["asset-b"]);
  });

  it("resolves our own uploads written as media:<id>, only when linked to the question", () => {
    const dto = toPublicQuestionDto({
      ...record,
      supportContents: [
        { id: "context", content: "![Contexto](media:asset-figure) ![](media:asset-elsewhere)", position: 0 },
      ],
    });

    expect(dto.textImages["media:asset-figure"]).toBe("/api/media/asset-figure");
    expect(dto.textImages["media:asset-elsewhere"]).toBeUndefined();
    expect(dto.media?.map((item) => item.id)).toEqual(["asset-n1", "asset-n2"]);
  });

  it("keeps every attachment when there is no image map", () => {
    const dto = toPublicQuestionDto({ ...record, textImageAssets: undefined });

    expect(dto.media).toHaveLength(3);
    expect(Object.keys(dto.textImages).every((key) => key.startsWith("media:"))).toBe(true);
  });
});
