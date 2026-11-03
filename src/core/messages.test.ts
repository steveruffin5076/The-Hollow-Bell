import { describe, expect, it } from "vitest";
import { MessageQueue } from "./messages";

describe("message queue", () => {
  it("shows messages raised in the same frame one after another, in order", () => {
    const q = new MessageQueue(2600, 1400);
    q.push("Experience +20", 0);
    q.push("Aldren's Blade is yours. Press I to see it.", 0);
    q.push("Where did you get his sword?", 0);
    expect(q.current(0)).toBe("Experience +20");
    expect(q.current(1399)).toBe("Experience +20");
    expect(q.current(1400)).toBe("Aldren's Blade is yours. Press I to see it.");
    expect(q.current(2800)).toBe("Where did you get his sword?");
    expect(q.current(2800 + 2599)).toBe("Where did you get his sword?");
    expect(q.current(2800 + 2600)).toBeNull();
  });

  it("keeps a lone message for the full time", () => {
    const q = new MessageQueue(2600, 1400);
    q.push("Rested.", 100);
    expect(q.current(2699)).toBe("Rested.");
    expect(q.current(2700)).toBeNull();
  });

  it("drops a repeat of the message showing or the last one waiting", () => {
    const q = new MessageQueue(2600, 1400);
    q.push("Healed", 0);
    q.push("Healed", 10);
    expect(q.waiting).toBe(0);
    q.push("Echo Strike", 20);
    q.push("Echo Strike", 30);
    expect(q.waiting).toBe(1);
    q.push("Healed", 40);
    expect(q.waiting).toBe(2);
  });

  it("drops the oldest waiting message past the limit", () => {
    const q = new MessageQueue(2600, 1400, 2);
    for (const text of ["a", "b", "c", "d"]) q.push(text, 0);
    expect(q.current(0)).toBe("a");
    expect(q.current(1400)).toBe("c");
    expect(q.current(2800)).toBe("d");
  });

  it("does not skip waiting messages after a long pause", () => {
    const q = new MessageQueue(2600, 1400);
    q.push("one", 0);
    q.push("two", 0);
    q.push("three", 0);
    expect(q.current(60000)).toBe("two");
    expect(q.current(61399)).toBe("two");
    expect(q.current(61400)).toBe("three");
  });

  it("clear removes everything", () => {
    const q = new MessageQueue();
    q.push("one", 0);
    q.push("two", 0);
    q.clear();
    expect(q.current(0)).toBeNull();
    expect(q.waiting).toBe(0);
  });
});
