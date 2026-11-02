import { describe, expect, it } from "bun:test";
import { loadEnv } from "../../src/config/env.ts";

describe("Environment Validation", () => {
  it("loads valid env with defaults", () => {
    const valid = {
      DATABASE_URL: "postgres://user:pass@localhost:5432/db",
      JWT_SECRET: "a-very-long-and-secure-jwt-secret-string-at-least-32-chars",
    };
    const env = loadEnv(valid);
    expect(env.PORT).toBe(3000);
    expect(env.AI_MODE).toBe("live");
    expect(env.CHUNK_TARGET_CHARS).toBe(3500);
  });

  it("throws clear error when required variable is missing", () => {
    expect(() => {
      loadEnv({
        DATABASE_URL: "",
        JWT_SECRET: "",
      });
    }).toThrow(/Environment configuration invalid/);
  });

  it("rejects fixture mode in production", () => {
    expect(() => {
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://user:pass@localhost:5432/db",
        JWT_SECRET: "a-very-long-and-secure-jwt-secret-string-at-least-32-chars",
        AI_MODE: "fixture",
      });
    }).toThrow(/AI_MODE=fixture is forbidden when NODE_ENV=production/);
  });
});
