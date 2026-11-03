import { describe, expect, it } from "vitest";
import { moveCircle, resolveCircleRects, type Rect } from "./collision";
import { MAX_FRAME_SECONDS, simulationDelta } from "./clock";
import { inputToWorldDirection } from "./movement";
import { boxDepth, boxScreenBounds, occludesHero } from "./occlusion";
import { groundDepth, screenToWorld, worldToScreen } from "./projection";

describe("projection", () => {
  it("maps a 32x32 tile to a 64x32 diamond", () => {
    const a = worldToScreen({ x: 0, y: 32 });
    const b = worldToScreen({ x: 32, y: 0 });
    const c = worldToScreen({ x: 32, y: 32 });
    expect(b.x - a.x).toBe(64);
    expect(c.y - worldToScreen({ x: 0, y: 0 }).y).toBe(32);
  });

  it("round-trips world -> screen -> world", () => {
    for (const p of [{ x: 0, y: 0 }, { x: 123.5, y: 40 }, { x: -50, y: 300.25 }]) {
      const back = screenToWorld(worldToScreen(p));
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it("round-trips screen -> world -> screen", () => {
    const s = { x: 210, y: -17 };
    const back = worldToScreen(screenToWorld(s));
    expect(back.x).toBeCloseTo(s.x, 9);
    expect(back.y).toBeCloseTo(s.y, 9);
  });

  it("depth grows towards the viewer", () => {
    expect(groundDepth({ x: 100, y: 100 })).toBeGreaterThan(groundDepth({ x: 50, y: 50 }));
  });
});

describe("movement", () => {
  const dirs = [
    { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    { x: 1, y: -1 }, { x: -1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 },
  ];

  it("gives unit world speed in all eight directions", () => {
    for (const d of dirs) {
      const w = inputToWorldDirection(d);
      expect(Math.hypot(w.x, w.y)).toBeCloseTo(1, 9);
    }
  });

  it("moves up on screen when W is held", () => {
    const w = inputToWorldDirection({ x: 0, y: -1 });
    const s = worldToScreen(w);
    expect(s.x).toBeCloseTo(0, 9);
    expect(s.y).toBeLessThan(0);
  });

  it("returns zero for no input", () => {
    expect(inputToWorldDirection({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe("collision", () => {
  const wall: Rect = { minX: 100, minY: 0, maxX: 132, maxY: 200 };

  it("does not move a circle that is clear", () => {
    expect(resolveCircleRects({ x: 50, y: 50 }, 8, [wall])).toEqual({ x: 50, y: 50 });
  });

  it("pushes a circle out of a wall face", () => {
    const p = resolveCircleRects({ x: 95, y: 50 }, 8, [wall]);
    expect(p.x).toBeCloseTo(92, 9);
    expect(p.y).toBe(50);
  });

  it("pushes a circle whose centre is inside a rectangle out by the nearest edge", () => {
    const p = resolveCircleRects({ x: 105, y: 50 }, 8, [wall]);
    expect(p.x).toBeCloseTo(92, 9);
  });

  it("cannot pass through a thin wall at high speed", () => {
    const thin: Rect = { minX: 100, minY: 0, maxX: 104, maxY: 200 };
    const p = moveCircle({ x: 50, y: 50 }, { x: 120, y: 0 }, 8, [thin]);
    expect(p.x).toBeLessThanOrEqual(92 + 1e-9);
  });

  it("slides along a wall when moving diagonally into it", () => {
    const p = moveCircle({ x: 90, y: 50 }, { x: 10, y: 10 }, 8, [wall]);
    expect(p.x).toBeLessThanOrEqual(92 + 1e-9);
    expect(p.y).toBeGreaterThan(55);
  });

  it("settles in an inside corner without escaping", () => {
    const a: Rect = { minX: 100, minY: 0, maxX: 132, maxY: 200 };
    const b: Rect = { minX: 0, minY: 100, maxX: 200, maxY: 132 };
    const p = moveCircle({ x: 60, y: 60 }, { x: 80, y: 80 }, 8, [a, b]);
    expect(p.x).toBeLessThanOrEqual(92 + 1e-9);
    expect(p.y).toBeLessThanOrEqual(92 + 1e-9);
  });
});

describe("occlusion", () => {
  const prop: Rect = { minX: 100, minY: 100, maxX: 132, maxY: 132 };
  const propBounds = boxScreenBounds(prop, 80);

  it("occludes a hero standing behind a tall prop", () => {
    const hero = { x: 105, y: 80 };
    const s = worldToScreen(hero);
    const heroBounds = { left: s.x - 8, right: s.x + 8, top: s.y - 34, bottom: s.y };
    expect(occludesHero(groundDepth(hero), heroBounds, boxDepth(prop), propBounds)).toBe(true);
  });

  it("does not occlude a hero standing in front of the prop", () => {
    const hero = { x: 150, y: 150 };
    const s = worldToScreen(hero);
    const heroBounds = { left: s.x - 8, right: s.x + 8, top: s.y - 34, bottom: s.y };
    expect(occludesHero(groundDepth(hero), heroBounds, boxDepth(prop), propBounds)).toBe(false);
  });

  it("does not occlude a hero far away on screen", () => {
    const hero = { x: 20, y: 20 };
    const s = worldToScreen(hero);
    const heroBounds = { left: s.x - 8, right: s.x + 8, top: s.y - 34, bottom: s.y };
    expect(occludesHero(groundDepth(hero), heroBounds, boxDepth(prop), propBounds)).toBe(false);
  });
});

describe("clock", () => {
  it("clamps long frames", () => {
    expect(simulationDelta(5000)).toBe(MAX_FRAME_SECONDS);
  });
  it("converts normal frames to seconds", () => {
    expect(simulationDelta(16)).toBeCloseTo(0.016, 9);
  });
  it("rejects bad deltas", () => {
    expect(simulationDelta(-5)).toBe(0);
    expect(simulationDelta(Number.NaN)).toBe(0);
  });
});
