/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";
import {
  checkOauthSignIn,
  createOauthUser,
  oauthRedirectOrigins,
} from "./lib/oauth";

const modules = import.meta.glob("./**/*.ts");
const verified = {
  email: "member@example.test",
  emailVerified: true,
  name: "Member",
};

beforeEach(() => vi.stubEnv("ADMIN_USERNAME", "admin@example.test"));
afterEach(() => vi.unstubAllEnvs());

describe("OAuth identity boundaries", () => {
  it.each([
    { ...verified, email: undefined },
    { ...verified, email: "  " },
    { ...verified, emailVerified: false },
    { ...verified, email: "  ADMIN@EXAMPLE.TEST " },
  ])("refuses missing, unverified, or admin emails", async (identity) => {
    const t = convexTest(schema, modules);
    await expect(
      t.run((ctx) => createOauthUser(ctx, identity, "google")),
    ).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("users").collect())).toHaveLength(
      0,
    );
  });

  it("links Google and GitHub to the same password user without changing profile or history", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("users", {
        username: verified.email,
        handle: "original",
        userNumber: 12,
        bio: "Keep me",
        publicProfile: true,
      }),
    );
    for (const provider of ["google", "github", "google"] as const) {
      expect(
        await t.run((ctx) =>
          createOauthUser(
            ctx,
            { ...verified, email: " MEMBER@EXAMPLE.TEST " },
            provider,
          ),
        ),
      ).toBe(id);
    }
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      handle: "original",
      userNumber: 12,
      bio: "Keep me",
      publicProfile: true,
      providers: ["password", "google", "github"],
    });
    expect(
      await t.run((ctx) => ctx.db.query("sequences").collect()),
    ).toHaveLength(0);
  });

  it("creates one private OAuth-only account across both providers", async () => {
    const t = convexTest(schema, modules);
    const google = await t.mutation(internal.users.createUserGoogle, {
      provider: {
        name: "google",
        accountId: "g1",
        profile: { ...verified, id: "g1" },
      },
    });
    const github = await t.mutation(internal.users.createUserGithub, {
      provider: {
        name: "github",
        accountId: "gh1",
        profile: { ...verified, id: "gh1", login: "member" },
      },
    });
    expect(github).toBe(google);
    expect(await t.run((ctx) => ctx.db.get(google))).toMatchObject({
      providers: ["google", "github"],
      publicProfile: false,
      userNumber: 1,
      status: "active",
    });
    await expect(
      t.mutation(internal.users.createUser, {
        provider: {
          name: "password",
          accountId: "p1",
          profile: { username: verified.email },
        },
      }),
    ).rejects.toThrow("existing sign in");
  });

  it("refuses blocked emails and blocked existing users", async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert("blockedEmails", { email: verified.email, blockedAt: 1 }),
    );
    await expect(
      t.run((ctx) => createOauthUser(ctx, verified, "google")),
    ).rejects.toThrow("cannot sign up");
    const t2 = convexTest(schema, modules);
    await t2.run((ctx) =>
      ctx.db.insert("users", { username: verified.email, status: "blocked" }),
    );
    await expect(
      t2.run((ctx) => createOauthUser(ctx, verified, "github")),
    ).rejects.toThrow("cannot sign up");
  });

  it("rechecks returning identities, including newly blocked or deleted users", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) => createOauthUser(ctx, verified, "google"));
    await t.run((ctx) => ctx.db.patch(id, { status: "paused" }));
    await expect(
      t.run((ctx) => checkOauthSignIn(ctx, verified, id)),
    ).resolves.toBeNull();
    await expect(
      t.run((ctx) =>
        checkOauthSignIn(ctx, { ...verified, emailVerified: false }, id),
      ),
    ).rejects.toThrow();
    await expect(
      t.run((ctx) =>
        checkOauthSignIn(ctx, { ...verified, email: "other@example.test" }, id),
      ),
    ).rejects.toThrow("no longer matches");
    await t.run((ctx) => ctx.db.patch(id, { status: "blocked" }));
    await expect(
      t.run((ctx) => checkOauthSignIn(ctx, verified, id)),
    ).rejects.toThrow("cannot sign up");
    await t.run((ctx) => ctx.db.delete(id));
    await expect(
      t.run((ctx) => checkOauthSignIn(ctx, verified, id)),
    ).rejects.toThrow("no longer matches");
  });
});

describe("OAuth origin allowlist", () => {
  it("normalizes and deduplicates exact origins", () => {
    expect(
      oauthRedirectOrigins(
        "https://www.askjev.ai",
        " http://localhost:5199,https://www.askjev.ai/ ",
      ),
    ).toEqual(["https://www.askjev.ai", "http://localhost:5199"]);
  });
  it.each([
    "https://*.askjev.ai",
    "https://user:pass@askjev.ai",
    "https://askjev.ai/path",
    "https://askjev.ai?x=1",
    "https://askjev.ai#x",
    "javascript:alert(1)",
  ])("rejects non-origin %s", (origin) => {
    expect(() =>
      oauthRedirectOrigins("https://www.askjev.ai", origin),
    ).toThrow();
  });
});
