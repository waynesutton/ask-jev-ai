import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { userMessage } from "./errors";

afterEach(() => vi.restoreAllMocks());

describe("userMessage", () => {
  it("shows the sentence the server put in ConvexError data", () => {
    // What the browser client builds on prod: the wrapper in message,
    // the real text in data.
    const error = new ConvexError(
      "[CONVEX M(profile:update)] [Request ID: abc] Server Error\n  Called by client",
    );
    (error as ConvexError<string>).data = "That handle is taken";
    expect(userMessage(error, "Could not save")).toBe("That handle is taken");
  });

  it("falls back and logs anything else", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error(
      "[CONVEX M(profile:update)] [Request ID: abc] Server Error",
    );
    expect(userMessage(error, "Could not save")).toBe("Could not save");
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0]?.[1]).toBe(error);
  });
});
