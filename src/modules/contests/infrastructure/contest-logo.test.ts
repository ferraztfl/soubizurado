import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { InvalidImageError } from "@/modules/question-bank/infrastructure/uploaded-question-image";

import { prepareContestLogo } from "./contest-logo";

async function pngFile(width: number, height: number): Promise<File> {
  const bytes = await sharp({ create: { width, height, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 1 } } })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(bytes)], "logo.png", { type: "image/png" });
}

describe("prepareContestLogo", () => {
  it("fits the logo in 256px, trims the empty border and keeps transparency", async () => {
    const prepared = await prepareContestLogo(await pngFile(800, 400));
    const metadata = await sharp(Buffer.from(prepared.bytes)).metadata();

    expect(prepared.mimeType).toBe("image/webp");
    expect(Math.max(prepared.width, prepared.height)).toBe(256);
    expect(metadata.hasAlpha).toBe(true);
  });

  it("rejects files that are not images", async () => {
    const file = new File([new TextEncoder().encode("not an image")], "logo.png", { type: "image/png" });
    await expect(prepareContestLogo(file)).rejects.toBeInstanceOf(InvalidImageError);
  });
});
