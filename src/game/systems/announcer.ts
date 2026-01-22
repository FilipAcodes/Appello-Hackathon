export type Announcer = Readonly<{
  onStart: () => string;
  onHit: (args: { hitter: string; victim: string }) => string;
  onKo: (args: { winner: string; loser: string }) => string;
  onMatchEnd: (args: { winner: string }) => string;
}>;

const START_LINES = [
  "WELCOME TO SMASHLOL. Please do not lick the controllers.",
  "BEGIN. May your jumps be crisp and your hits be emotionally damaging.",
  "FIGHT! (Legally distinct, spiritually identical.)"
];

const HIT_LINES = [
  "BONK CERTIFIED. Your ancestors felt that.",
  "That was personal. You okay?",
  "Someone call physics. It's filing a complaint.",
  "A perfectly good face. Unfortunate."
];

const KO_LINES = [
  "They have left the atmosphere. Say hi to satellites.",
  "That stock got deleted. Like your confidence.",
  "Goodnight. Try again with hands next time."
];

const END_LINES = [
  "VICTORY! The crowd goes mildly wild.",
  "WINNER! Please sign autographs on bananas only."
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function createAnnouncer(): Announcer {
  return {
    onStart: () => pick(START_LINES),
    onHit: ({ hitter, victim }) => `${pick(HIT_LINES)} (${hitter} hit ${victim})`,
    onKo: ({ winner, loser }) => `${pick(KO_LINES)} (${winner} KO'd ${loser})`,
    onMatchEnd: ({ winner }) => `${pick(END_LINES)} (${winner})`
  };
}

