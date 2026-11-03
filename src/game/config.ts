export const GAME_TITLE = "The Hollow Bell";
export const GAME_VERSION = "0.1.0";
export const GAME_VERSION_LABEL = `v${GAME_VERSION} - prototype`;

/** Logical resolution. The canvas is scaled to fit the window. */
export const LOGICAL_WIDTH = 960;
export const LOGICAL_HEIGHT = 540;

export const SCENE_KEYS = {
  boot: "Boot",
  sandbox: "Sandbox",
  combat: "Combat",
  play: "Play",
} as const;
