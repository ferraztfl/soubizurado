import { describe, expect, it } from "vitest";

import { decideMediaAccess } from "./media-access-policy";

describe("decideMediaAccess", () => {
  it("serves media of published questions publicly with long cache", () => {
    const decision = decideMediaAccess({
      mimeType: "image/png",
      linkedToPublishedQuestion: true,
      isAdmin: false,
    });

    expect(decision).toMatchObject({
      allowed: true,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  it("hides media of unpublished questions from non-admins", () => {
    expect(
      decideMediaAccess({ mimeType: "image/png", linkedToPublishedQuestion: false, isAdmin: false }),
    ).toEqual({ allowed: false });
  });

  it("lets admins preview unpublished media without shared caching", () => {
    const decision = decideMediaAccess({
      mimeType: "image/jpeg",
      linkedToPublishedQuestion: false,
      isAdmin: true,
    });

    expect(decision.allowed && decision.headers["Cache-Control"]).toBe("private, no-store");
  });

  it("sandboxes SVG so embedded scripts cannot run", () => {
    const decision = decideMediaAccess({
      mimeType: "image/svg+xml",
      linkedToPublishedQuestion: true,
      isAdmin: false,
    });

    expect(decision.allowed && decision.headers["Content-Security-Policy"]).toContain("sandbox");
    expect(decision.allowed && decision.headers["Content-Security-Policy"]).toContain("default-src 'none'");
  });
});
