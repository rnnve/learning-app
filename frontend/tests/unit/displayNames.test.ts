import type { Job } from "@/api/types";
import { decodeDisplayName, normalizeDisplayNames } from "@/lib/displayNames";
import { getJobTarget } from "@/lib/jobNavigation";

describe("recording regressions", () => {
  it("decodes Thai filenames without changing message content or malformed escapes", () => {
    const name = "วิชาวิทยาศาสตร์.docx";
    const encoded = encodeURIComponent(name);
    const result = normalizeDisplayNames({
      title: encoded,
      originalFilenames: [encoded],
      content: encoded,
      items: [{ title: encoded }],
    });
    expect(result.title).toBe(name);
    expect(result.originalFilenames).toEqual([name]);
    expect(result.items[0].title).toBe(name);
    expect(result.content).toBe(encoded);
    expect(decodeDisplayName("score 50%")).toBe("score 50%");
    expect(decodeDisplayName("%E0broken")).toBe("%E0broken");
  });

  it("opens running jobs using their source relation instead of an empty result", () => {
    expect(getJobTarget({ result: null, sourceId: "source-1" } as Job)).toBe("/source/source-1");
    expect(
      getJobTarget({ result: { materialId: "material-1" }, sourceId: "source-1" } as Job),
    ).toBe("/material/material-1");
    expect(getJobTarget({ result: null } as Job)).toBe("/(tabs)/history");
  });
});
