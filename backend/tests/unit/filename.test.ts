import { expect, it } from "bun:test";
import { decodeFilename } from "../../src/lib/filename.ts";

it("decodes iOS-encoded filenames and keeps ordinary/malformed names intact", () => {
  const name = "วิชาวิทยาศาสตร์.docx";
  expect(decodeFilename(encodeURIComponent(name))).toBe(name);
  expect(decodeFilename("50% notes.txt")).toBe("50% notes.txt");
});
