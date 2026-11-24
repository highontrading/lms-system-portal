import { describe, expect, it } from "vitest";
import { can } from "@/lib/permissions";
import { contrastRatio, readableOn, themeCss } from "@/lib/theme";
import { safeHref, safeRedirectPath, slugify } from "@/lib/utils";
import { youtubeId, vimeoId, detectVideoProvider } from "@/lib/video";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { decryptSecret, encryptSecret, signValue, verifySignedValue } from "@/server/crypto";

describe("passwords", () => {
  it("hashes with a salt and verifies only the right password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(passwordProblem("short")).toBeTruthy();
    expect(passwordProblem("aaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("a decent passphrase")).toBeNull();
  });
});

describe("stored credentials", () => {
  it("encrypts and decrypts, and never returns garbage for tampered values", () => {
    const sealed = encryptSecret("sk_live_123");
    expect(sealed).not.toContain("sk_live_123");
    expect(decryptSecret(sealed)).toBe("sk_live_123");
    expect(decryptSecret(`${sealed.slice(0, -4)}AAAA`)).toBe("");
  });

  it("verifies signed values", () => {
    const signature = signValue("payload");
    expect(verifySignedValue("payload", signature)).toBe(true);
    expect(verifySignedValue("payload2", signature)).toBe(false);
  });
});

describe("url safety", () => {
  it("only follows redirects to paths on this site", () => {
    expect(safeRedirectPath("/learn/x")).toBe("/learn/x");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(undefined, "/admin")).toBe("/admin");
  });

  it("drops javascript: and other unsafe links", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("/catalog")).toBe("/catalog");
  });

  it("makes clean slugs", () => {
    expect(slugify("  AI & Automation: Crème brûlée! ")).toBe("ai-and-automation-creme-brulee");
  });
});

describe("permissions", () => {
  it("keeps students out of the admin panel and limits support staff", () => {
    expect(can("STUDENT", "admin.access")).toBe(false);
    expect(can("SUPPORT", "enrollments.manage")).toBe(true);
    expect(can("SUPPORT", "settings.manage")).toBe(false);
    expect(can("OWNER", "team.manage")).toBe(true);
  });
});

describe("theme and video helpers", () => {
  it("picks readable text for any brand colour", () => {
    expect(readableOn("#5B4BF5")).toBe("#FFFFFF");
    expect(readableOn("#FFC93C")).toBe("#14121F");
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(themeCss({ brandColor: "not-a-colour", accentColor: "#FFC93C", radius: "soft" })).toContain("--brand:#5B4BF5");
  });

  it("recognises video links", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(vimeoId("https://vimeo.com/123456789")?.id).toBe("123456789");
    expect(detectVideoProvider("https://cdn.example.com/video.mp4")).toBe("URL");
  });
});
