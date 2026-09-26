import { describe, expect, it, vi } from "vitest";

import { SupabaseMediaStorage } from "./supabase-media-storage";

function fakeClient(bucketApi: Record<string, unknown>) {
  const from = vi.fn().mockReturnValue(bucketApi);

  return {
    client: { storage: { from } } as unknown as ConstructorParameters<typeof SupabaseMediaStorage>[0]["client"],
    from,
  };
}

describe("SupabaseMediaStorage", () => {
  it("uploads without overwriting, with content type and long cache", async () => {
    const upload = vi.fn().mockResolvedValue({ data: {}, error: null });
    const { client, from } = fakeClient({ upload });
    const storage = new SupabaseMediaStorage({ client, bucket: "question-media" });

    await storage.put({ storageKey: "sha256/ab/cd/x.png", mimeType: "image/png", bytes: new Uint8Array([1]) });

    expect(storage.provider).toBe("SUPABASE_STORAGE");
    expect(from).toHaveBeenCalledWith("question-media");
    expect(upload).toHaveBeenCalledWith("sha256/ab/cd/x.png", new Uint8Array([1]), {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
  });

  it("treats an existing object as success (content-addressed keys)", async () => {
    const upload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "The resource already exists", statusCode: "409" },
    });
    const { client } = fakeClient({ upload });

    await expect(
      new SupabaseMediaStorage({ client, bucket: "b" }).put({
        storageKey: "sha256/x.png",
        mimeType: "image/png",
        bytes: new Uint8Array([1]),
      }),
    ).resolves.toBeUndefined();
  });

  it("fails on other upload errors and rejects unsafe keys", async () => {
    const upload = vi.fn().mockResolvedValue({ data: null, error: { message: "quota exceeded", statusCode: "413" } });
    const { client } = fakeClient({ upload });
    const storage = new SupabaseMediaStorage({ client, bucket: "b" });

    await expect(
      storage.put({ storageKey: "a.png", mimeType: "image/png", bytes: new Uint8Array() }),
    ).rejects.toThrow("quota exceeded");
    await expect(
      storage.put({ storageKey: "../escape.png", mimeType: "image/png", bytes: new Uint8Array() }),
    ).rejects.toThrow("Invalid media storage key");
  });

  it("reads bytes or returns null when missing", async () => {
    const download = vi
      .fn()
      .mockResolvedValueOnce({ data: new Blob([new Uint8Array([7, 8])]), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "Object not found" } });
    const { client } = fakeClient({ download });
    const storage = new SupabaseMediaStorage({ client, bucket: "b" });

    await expect(storage.read("k")).resolves.toEqual(new Uint8Array([7, 8]));
    await expect(storage.read("missing")).resolves.toBeNull();
  });
});
