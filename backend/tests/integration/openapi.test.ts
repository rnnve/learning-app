import { describe, expect, it } from "bun:test";
import { createServerApp } from "../../src/app.ts";

describe("OpenAPI Spec and Route Coverage", () => {
  const app = createServerApp();

  const REQUIRED_CONTRACT_ROUTES: { method: string; path: string; isPublic?: boolean }[] = [
    { method: "get", path: "/health", isPublic: true },
    { method: "get", path: "/ready", isPublic: true },
    { method: "get", path: "/v1/meta", isPublic: true },
    { method: "post", path: "/v1/auth/guest", isPublic: true },
    { method: "post", path: "/v1/auth/register", isPublic: true },
    { method: "post", path: "/v1/auth/login", isPublic: true },
    { method: "post", path: "/v1/auth/refresh", isPublic: true },
    { method: "post", path: "/v1/auth/logout", isPublic: true },
    { method: "get", path: "/v1/me" },
    { method: "patch", path: "/v1/me" },
    { method: "put", path: "/v1/me/consent" },
    { method: "delete", path: "/v1/me" },
    { method: "get", path: "/v1/home" },
    { method: "post", path: "/v1/sources" },
    { method: "get", path: "/v1/sources" },
    { method: "get", path: "/v1/sources/{id}" },
    { method: "patch", path: "/v1/sources/{id}" },
    { method: "get", path: "/v1/sources/{id}/files/{index}" },
    { method: "get", path: "/v1/sources/{id}/text" },
    { method: "post", path: "/v1/sources/{id}/retry" },
    { method: "delete", path: "/v1/sources/{id}" },
    { method: "post", path: "/v1/materials" },
    { method: "get", path: "/v1/materials" },
    { method: "get", path: "/v1/materials/{id}" },
    { method: "patch", path: "/v1/materials/{id}" },
    { method: "delete", path: "/v1/materials/{id}" },
    { method: "get", path: "/v1/materials/{id}/flashcard-progress" },
    { method: "get", path: "/v1/jobs/{id}" },
    { method: "get", path: "/v1/jobs" },
    { method: "post", path: "/v1/jobs/{id}/retry" },
    { method: "post", path: "/v1/jobs/{id}/cancel" },
    { method: "post", path: "/v1/conversations" },
    { method: "get", path: "/v1/conversations" },
    { method: "get", path: "/v1/conversations/{id}" },
    { method: "patch", path: "/v1/conversations/{id}" },
    { method: "delete", path: "/v1/conversations/{id}" },
    { method: "get", path: "/v1/conversations/{id}/messages" },
    { method: "post", path: "/v1/conversations/{id}/messages" },
    { method: "post", path: "/v1/study-sessions" },
    { method: "get", path: "/v1/study-sessions" },
    { method: "get", path: "/v1/study-sessions/{id}" },
    { method: "post", path: "/v1/study-sessions/{id}/answers" },
    { method: "post", path: "/v1/study-sessions/{id}/complete" },
  ];

  it("serves openapi.json and includes all contract endpoints", async () => {
    const res = await app.handle(new Request("http://localhost/docs/json"));
    expect(res.status).toBe(200);
    const spec = (await res.json()) as any;
    expect(spec.openapi).toBeDefined();
    expect(spec.paths).toBeDefined();

    for (const route of REQUIRED_CONTRACT_ROUTES) {
      const pathDef = spec.paths[route.path];
      expect(pathDef).toBeDefined();
      expect(pathDef[route.method]).toBeDefined();
    }
  });

  it("walks route list and asserts every non-PUBLIC route returns 401 without token", async () => {
    const protectedRoutes = REQUIRED_CONTRACT_ROUTES.filter((r) => !r.isPublic);

    for (const route of protectedRoutes) {
      // Substitute dummy param values for {id} and {index}
      const testPath = route.path
        .replace("{id}", "00000000-0000-0000-0000-000000000000")
        .replace("{index}", "0");

      const req = new Request(`http://localhost${testPath}`, {
        method: route.method.toUpperCase(),
        headers: { "Content-Type": "application/json" },
        body: route.method === "get" || route.method === "delete" ? undefined : JSON.stringify({}),
      });

      const res = await app.handle(req);
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe("UNAUTHENTICATED");
    }
  });
});
