import { describe, expect, it } from "vitest";
import { GAME_TITLE, GAME_VERSION_LABEL, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./config";

describe("game config", () => {
  it("has the locked title and a version label", () => {
    expect(GAME_TITLE).toBe("The Hollow Bell");
    expect(GAME_VERSION_LABEL).toContain("0.1.0");
  });

  it("uses a 16:9 logical resolution", () => {
    expect(LOGICAL_WIDTH / LOGICAL_HEIGHT).toBeCloseTo(16 / 9, 5);
  });
});
