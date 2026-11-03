import { BROTHER_NAME, type NpcId } from "../data/content";
import type { Story } from "./story";

export interface DialogueOption {
  label: string;
  effect: "accept" | "complete" | "close";
}

export interface DialoguePage {
  speaker: string;
  text: string;
  options: DialogueOption[];
}

const CLOSE: DialogueOption = { label: "Leave", effect: "close" };

/** One page per talk. Returns null when that person is not here. */
export function openingLine(npc: NpcId, story: Story): DialoguePage | null {
  switch (npc) {
    case "bram":
      return bram(story);
    case "mara":
      return {
        speaker: "Mara, innkeeper",
        text: story.clueKnown
          ? `${BROTHER_NAME}. I almost said it myself, and the bell took it. Do not say it in the square.`
          : "Bram drinks to a brother. I have poured for this town for twenty years. There was never a second chair.",
        options: [CLOSE],
      };
    case "oren":
      return {
        speaker: "Oren, bell keeper",
        text: "Each toll takes a living name out of every head but yours. I ring it so the dead stay outside. I do not choose who is forgotten.",
        options: [CLOSE],
      };
    case "watchman":
      if (story.outcome !== "spare") return null;
      return {
        speaker: "Aldren, the Watchman",
        text: "You spoke my name. I will stand where people can see me, until the next toll.",
        options: [CLOSE],
      };
  }
}

function bram(story: Story): DialoguePage {
  if (story.status === "not-accepted") {
    return {
      speaker: "Bram, blacksmith",
      text: "My brother wore a silver charm. The town says I never had a brother. Bring it back from the watchtower, if any of that is real.",
      options: [
        { label: "I'll look.", effect: "accept" },
        { label: "Not now.", effect: "close" },
      ],
    };
  }
  if (story.status === "active") {
    return {
      speaker: "Bram, blacksmith",
      text: "The east road leads to the tower. He answered to a name no one else can hold onto.",
      options: [CLOSE],
    };
  }
  if (story.status === "clue-found") {
    return {
      speaker: "Bram, blacksmith",
      text: `You know his name. If the Watchman still kneels, speak it, or end him. I need the truth either way.`,
      options: [CLOSE],
    };
  }
  if (story.status === "returned") {
    const text =
      story.outcome === "spare"
        ? `He is in the square. He kept the charm. You gave me my brother back, not the silver.`
        : "You brought his sword, not the charm. Then he is gone. I will remember the blade.";
    return {
      speaker: "Bram, blacksmith",
      text,
      options: [{ label: "Then this is finished.", effect: "complete" }],
    };
  }
  if (story.status === "complete") {
    return {
      speaker: "Bram, blacksmith",
      text:
        story.outcome === "spare"
          ? "Go and talk to him, if you can bear it. I am still learning his face."
          : "The blade hangs by the forge. Thank you for not letting the bell have the last word.",
      options: [CLOSE],
    };
  }
  return {
    speaker: "Bram, blacksmith",
    text: "You came back. Tell me when you are ready.",
    options: [CLOSE],
  };
}
