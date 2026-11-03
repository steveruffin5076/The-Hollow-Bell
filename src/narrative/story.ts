import { BROTHER_NAME, type Outcome, type QuestStatus } from "../data/content";

export interface Story {
  status: QuestStatus;
  clueKnown: boolean;
  outcome: Outcome | null;
  echoLineDelivered: boolean;
}

export function freshStory(): Story {
  return { status: "not-accepted", clueKnown: false, outcome: null, echoLineDelivered: false };
}

const ORDER: QuestStatus[] = [
  "not-accepted",
  "active",
  "clue-found",
  "guardian-resolved",
  "returned",
  "complete",
];

function before(status: QuestStatus, mark: QuestStatus): boolean {
  return ORDER.indexOf(status) < ORDER.indexOf(mark);
}

export function acceptQuest(story: Story): Story {
  if (story.status !== "not-accepted") return story;
  return { ...story, status: story.clueKnown ? "clue-found" : "active" };
}

export function findClue(story: Story): Story {
  const status = story.status === "active" ? "clue-found" : story.status;
  if (story.clueKnown && status === story.status) return story;
  return { ...story, clueKnown: true, status };
}

/** Kill is always allowed. Spare needs the clue. A set outcome never changes. */
export function resolveGuardian(story: Story, outcome: Outcome): Story {
  if (story.outcome) return story;
  if (outcome === "spare" && !story.clueKnown) return story;
  return {
    ...story,
    outcome,
    status: before(story.status, "guardian-resolved") ? "guardian-resolved" : story.status,
  };
}

export function enterTown(story: Story): Story {
  if (story.status !== "guardian-resolved") return story;
  return { ...story, status: "returned" };
}

export function completeQuest(story: Story): Story {
  if (story.status !== "returned") return story;
  return { ...story, status: "complete" };
}

export function markEchoLine(story: Story): Story {
  if (story.echoLineDelivered) return story;
  return { ...story, echoLineDelivered: true };
}

export function objective(story: Story): string {
  switch (story.status) {
    case "not-accepted":
      return story.clueKnown
        ? `You learned the name ${BROTHER_NAME}. Speak with Bram the blacksmith.`
        : "The town is uneasy. Speak with Bram the blacksmith.";
    case "active":
      return "Bram asked for his brother's silver charm. Search the watchtower road.";
    case "clue-found":
      return `The guardian's name is ${BROTHER_NAME}. Reach the watchtower.`;
    case "guardian-resolved":
      return "Return to Bram.";
    case "returned":
      return "Tell Bram what happened at the tower.";
    case "complete":
      return story.outcome === "spare"
        ? `${BROTHER_NAME} stands in the square. The charm stayed with him.`
        : "Bram has his brother's sword. The watchtower is quiet.";
  }
}
