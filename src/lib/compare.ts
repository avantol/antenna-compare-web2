import { distance, azimuth } from "./maidenhead";
import type { ReceptionReport } from "@/lib/types";

export interface CompareOptions {
  maxTimeDiff: number;
  minDistKm: number;
  azimuthDeg: number;
  beamWidth: number;
  useMiles: boolean;
}

export interface SpotResult {
  dxCall: string;
  snrDelta: number;
  distanceVal: number;
  azimuthVal: number;
}

export interface CompareResult {
  spots: SpotResult[];
  avgSnrDelta: number;
  spotCount: number;
}

type ReportDict = Map<string, ReceptionReport[]>;

export function buildReportDict(reports: ReceptionReport[]): ReportDict {
  const dict: ReportDict = new Map();
  for (const r of reports) {
    const key = r.receiverCallsign;
    if (!dict.has(key)) {
      dict.set(key, []);
    }
    dict.get(key)!.push(r);
  }
  return dict;
}

export function compareAntennas(
  dict1: ReportDict,
  dict2: ReportDict,
  options: CompareOptions
): CompareResult {
  const { maxTimeDiff, minDistKm, beamWidth, useMiles } = options;

  let minAz = options.azimuthDeg - Math.floor(beamWidth / 2);
  if (minAz < 0) minAz += 360;
  let maxAz = options.azimuthDeg + Math.floor(beamWidth / 2);
  if (maxAz > 359) maxAz -= 360;

  const spots: SpotResult[] = [];
  let snrSum = 0;

  for (const [receiver, list1] of dict1) {
    const list2 = dict2.get(receiver);
    if (!list2) continue;

    for (const r1 of list1) {
      let bestTimeDiff = Infinity;
      let bestSnr = 0;
      let bestR2: ReceptionReport | null = null;

      for (const r2 of list2) {
        const t = Math.abs(r1.flowStartSeconds - r2.flowStartSeconds);
        if (t < bestTimeDiff) {
          bestTimeDiff = t;
          bestR2 = r2;
          bestSnr = r1.snr - r2.snr;
        }
      }

      if (bestTimeDiff <= maxTimeDiff && bestR2) {
        let d = distance(bestR2.senderLocator, bestR2.receiverLocator);
        const a = azimuth(bestR2.senderLocator, bestR2.receiverLocator);

        let bMin = minAz;
        let ta = a;
        if (minAz > maxAz) {
          if (a > minAz) ta = a - 360;
          bMin = minAz - 360;
        }

        if (d >= minDistKm && ((ta >= bMin && ta <= maxAz) || beamWidth >= 359)) {
          if (useMiles) {
            d /= 1.60934;
          }

          spots.push({
            dxCall: receiver,
            snrDelta: bestSnr,
            distanceVal: d,
            azimuthVal: a,
          });
          snrSum += bestSnr;
        }
      }
    }
  }

  return {
    spots,
    avgSnrDelta: spots.length > 0 ? snrSum / spots.length : 0,
    spotCount: spots.length,
  };
}
