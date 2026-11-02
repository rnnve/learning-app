import { describe, expect, it } from "bun:test";
import { createServerApp } from "../../src/app.ts";

describe("Public System Routes", () => {
  const app = createServerApp();

  it("returns 200 from /health", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("ok");
    expect(body.version).toBe("1.0.0");
    expect(body.uptimeSec).toBeDefined();
  });

  it("returns 200 or 503 from /ready with expected check structure", async () => {
    const res = await app.handle(new Request("http://localhost/ready"));
    const body = (await res.json()) as any;
    expect(body.status).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.nemotron).toBeDefined();
    expect(body.checks.gemini).toBeDefined();
  });

  it("returns 200 from /v1/meta with limits and supported MIME types", async () => {
    const res = await app.handle(new Request("http://localhost/v1/meta"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.apiVersion).toBe("1");
    expect(body.promptVersion).toBe("system.v1");
    expect(body.limits.maxImageBytes).toBe(10 * 1024 * 1024);
    expect(body.supported.imageMimeTypes).toContain("image/jpeg");
    expect(body.supported.documentMimeTypes).toContain("application/pdf");
    expect(body.consentVersion).toBeDefined();
  });
});
