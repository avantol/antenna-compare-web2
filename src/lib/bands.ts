export const BANDS = [
  "2m", "6m", "10m", "12m", "15m", "17m", "20m", "30m", "40m", "60m", "80m", "160m",
] as const;

export type Band = (typeof BANDS)[number];

// wspr.live integer band values (from wspr.bands table)
export const WSPR_BAND_MAP: Record<string, number> = {
  "160m": 1,
  "80m": 3,
  "60m": 5,
  "40m": 7,
  "30m": 10,
  "20m": 14,
  "17m": 18,
  "15m": 21,
  "12m": 24,
  "10m": 28,
  "6m": 50,
  "2m": 144,
};

export function freqToBand(freqMHz: number): string {
  if (freqMHz >= 0.1357 && freqMHz <= 0.1378) return "2200m";
  if (freqMHz >= 0.472 && freqMHz <= 0.479) return "630m";
  if (freqMHz >= 1.8 && freqMHz <= 2.0) return "160m";
  if (freqMHz >= 3.5 && freqMHz <= 4.0) return "80m";
  if (freqMHz >= 5.35 && freqMHz <= 5.37) return "60m";
  if (freqMHz >= 7.0 && freqMHz <= 7.3) return "40m";
  if (freqMHz >= 10.1 && freqMHz <= 10.15) return "30m";
  if (freqMHz >= 14.0 && freqMHz <= 14.35) return "20m";
  if (freqMHz >= 18.068 && freqMHz <= 18.168) return "17m";
  if (freqMHz >= 21.0 && freqMHz <= 21.45) return "15m";
  if (freqMHz >= 24.89 && freqMHz <= 24.99) return "12m";
  if (freqMHz >= 28.0 && freqMHz <= 29.7) return "10m";
  if (freqMHz >= 50.0 && freqMHz <= 54.0) return "6m";
  if (freqMHz >= 144.0 && freqMHz <= 148.0) return "2m";
  return "";
}