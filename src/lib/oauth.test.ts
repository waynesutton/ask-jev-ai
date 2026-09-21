import { describe, expect, it } from "vitest";
import { oauthErrorMessage, safeNextPath } from "./oauth";

describe("OAuth return paths", () => {
  const origin = "https://www.askjev.ai";
  it("preserves a local question, query, and follow-up anchor", () => {
    expect(safeNextPath("/a/123?view=thread#follow-up", origin)).toBe(
      "/a/123?view=thread#follow-up",
    );
  });
  it.each([
    null,
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\n/evil.test",
    "javascript:alert(1)",
  ])("refuses external or ambiguous return path %s", (next) => {
    expect(safeNextPath(next, origin)).toBe("/");
  });
  it("shows a useful cancellation and server rejection", () => {
    expect(oauthErrorMessage({ code: "access_denied" })).toBe(
      "You cancelled the sign in",
    );
    expect(
      oauthErrorMessage({
        code: "rejected",
        message: "This email signs in with a password",
      }),
    ).toBe("This email signs in with a password");
  });
});
