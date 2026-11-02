import { redirectSystemPath } from "../../app/+native-intent";

describe("redirectSystemPath", () => {
  it("normalizes the raw Expo Go separator", () => {
    expect(redirectSystemPath({ path: "/--/", initial: true })).toBe("/");
  });
  it("maps the Expo Go root separator to the app root", () => {
    expect(
      redirectSystemPath({
        path: "exp://192.168.1.39:8081/--/",
        initial: true,
      }),
    ).toBe("/");
  });

  it("preserves an app path after the Expo Go separator", () => {
    expect(
      redirectSystemPath({
        path: "exp://192.168.1.39:8081/--/library?filter=saved",
        initial: true,
      }),
    ).toBe("/library?filter=saved");
  });

  it("leaves ordinary deep links unchanged", () => {
    expect(redirectSystemPath({ path: "thaistudy://material/123", initial: true })).toBe(
      "thaistudy://material/123",
    );
  });
});
