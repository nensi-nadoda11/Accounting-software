const durationPattern = /^(\d+)([smhd])$/i;

export const parseDurationToMs = (duration: string): number => {
  const match = duration.trim().match(durationPattern);

  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, rawValue, rawUnit] = match;
  const value = Number(rawValue);
  const unit = rawUnit!.toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000
  };

  return value * multipliers[unit]!;
};

export const parseDurationToSeconds = (duration: string): number =>
  Math.floor(parseDurationToMs(duration) / 1000);
