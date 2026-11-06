// Monthly reminder to turn the board by 3 sectors (docs/UI.md, Lobby): the spreads wear unevenly.
const DUE_DAYS = 30;

/** Due when never rotated (null) or 30+ days since `rotatedAt` (ISO date). */
export function rotateBoardDue(rotatedAt: string | null, now: Date): boolean {
  if (!rotatedAt) return true;
  const t = Date.parse(rotatedAt);
  return Number.isNaN(t) || now.getTime() - t >= DUE_DAYS * 86_400_000;
}
