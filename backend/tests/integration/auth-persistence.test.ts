import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

function isolatedStore(...steps: string[]) {
  const root = mkdtempSync(join(tmpdir(), "thaistudy-auth-"));
  if (dirname(resolve(root)) !== resolve(tmpdir())) throw new Error("Unexpected test directory");
  try {
    for (const step of steps) {
      const process = Bun.spawnSync({
        cmd: [
          Bun.which("bun")!,
          "-e",
          `
          import assert from "node:assert/strict";
          import { writeFile, unlink, readFile } from "node:fs/promises";
          import { dirname } from "node:path";
          import { createServerApp } from "./src/app.ts";
          import { getDb, schema, checkDbHealth } from "./src/db/client.ts";
          const app = createServerApp();
          const call = (path, body, token) => app.handle(new Request("http://localhost/v1" + path, {
            method: "POST",
            headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
            body: JSON.stringify(body),
          }));
          ${step}
        `,
        ],
        cwd: resolve(import.meta.dir, "../.."),
        env: {
          ...Bun.env,
          NODE_ENV: "test",
          AI_MODE: "disabled",
          JSON_DB_PATH: join(root, "data", "db.json"),
          STORAGE_DIR: join(root, "storage"),
          JWT_SECRET: "isolated-auth-test-secret-at-least-32-characters",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      if (process.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(process.stderr));
      }
      expect(process.exitCode).toBe(0);
    }
  } finally {
    // Only delete the unique temporary directory allocated for this test.
    rmSync(root, { recursive: true, force: true });
  }
}

describe("Authentication persistence", () => {
  it("reports unwritable storage and allows registration to retry after a failed write", () => {
    isolatedStore(`
      await getDb().select().from(schema.users);
      await writeFile(dirname(Bun.env.JSON_DB_PATH), "block the database directory");
      const ready = await app.handle(new Request("http://localhost/ready"));
      assert.equal(ready.status, 503);
      assert.equal((await ready.json()).checks.database, "fail");
      const account = { email: "retry@example.test", password: "auth-test-password", displayName: "Retry" };
      const failed = await call("/auth/register", account);
      assert.equal(failed.status, 500);
      assert.equal((await getDb().select().from(schema.users)).length, 0);
      await unlink(dirname(Bun.env.JSON_DB_PATH));
      const retried = await call("/auth/register", account);
      assert.equal(retried.status, 201, JSON.stringify(await retried.clone().json()));
      assert.equal(await checkDbHealth(), true);
      const saved = JSON.parse(await readFile(Bun.env.JSON_DB_PATH, "utf8"));
      assert.equal(saved.users.length, 1);
      assert.equal((await call("/auth/login", account)).status, 200);
    `);
  }, 15_000);

  it("persists new accounts and guest upgrades across process restarts", () => {
    isolatedStore(
      `
      const account = { email: "member@example.test", password: "auth-test-password", displayName: "Member" };
      assert.equal((await call("/auth/register", account)).status, 201);
      assert.equal((await call("/auth/register", account)).status, 409);
      const guestResponse = await call("/auth/guest", {});
      assert.equal(guestResponse.status, 201);
      const guest = await guestResponse.json();
      const upgrade = await call("/auth/register", {
        ...account, email: "upgraded@example.test",
      }, guest.tokens.accessToken);
      assert.equal(upgrade.status, 201);
      const upgraded = await upgrade.json();
      assert.equal(upgraded.user.id, guest.user.id);
      assert.equal(upgraded.user.isGuest, false);
    `,
      `
      for (const email of ["member@example.test", "upgraded@example.test"]) {
        const response = await call("/auth/login", { email, password: "auth-test-password" });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).user.email, email);
      }
      assert.equal((await getDb().select().from(schema.users)).length, 2);
    `,
    );
  }, 15_000);
});
