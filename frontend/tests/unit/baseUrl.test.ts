import { expoDevelopmentHost, resolveApiBaseUrl } from "@/api/baseUrl";

describe("resolveApiBaseUrl", () => {
  it("uses the Expo host for a loopback API on a physical development device", () => {
    expect(
      resolveApiBaseUrl("http://127.0.0.1:3000", {
        isDevelopment: true,
        expoHostUri: "192.168.1.42:8081",
      }),
    ).toBe("http://192.168.1.42:3000");
  });

  it("also handles localhost and full Expo URLs", () => {
    expect(
      resolveApiBaseUrl("http://localhost:3000/", {
        isDevelopment: true,
        expoHostUri: "http://10.0.0.8:8081",
      }),
    ).toBe("http://10.0.0.8:3000");
  });

  it("does not rewrite an explicit API host", () => {
    expect(
      resolveApiBaseUrl("https://api.example.com", {
        isDevelopment: true,
        expoHostUri: "192.168.1.42:8081",
      }),
    ).toBe("https://api.example.com");
  });

  it("does not rewrite production configuration", () => {
    expect(
      resolveApiBaseUrl("http://127.0.0.1:3000", {
        isDevelopment: false,
        expoHostUri: "192.168.1.42:8081",
      }),
    ).toBe("http://127.0.0.1:3000");
  });
});

describe("expoDevelopmentHost", () => {
  it("returns null for missing or invalid host data", () => {
    expect(expoDevelopmentHost(undefined)).toBeNull();
    expect(expoDevelopmentHost("not a host:still not a port")).toBeNull();
  });
});
