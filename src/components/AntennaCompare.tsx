"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { BANDS } from "@/lib/bands";
import {
  buildReportDict,
  compareAntennas,
  type SpotResult,
  type CompareResult,
} from "@/lib/compare";
import type { ReceptionReport } from "@/lib/types";

type ReportDict = Map<string, ReceptionReport[]>;

function formatAge(dateTime: Date | null): string {
  if (!dateTime) return "";
  const sec = (Date.now() - dateTime.getTime()) / 1000;
  const min = Math.floor(sec / 60);
  if (min <= 1) return "";
  const s = min <= 60 ? `${min}` : "60+";
  return `(${s} minutes old)`;
}

export default function AntennaCompare() {
  const [call1, setCall1] = useState("");
  const [call2, setCall2] = useState("");
  const [band, setBand] = useState("");
  const [mode, setMode] = useState<"FT8" | "FT4" | "WSPR">("FT8");
  const [periodMins, setPeriodMins] = useState("");
  const [twoTransmitters, setTwoTransmitters] = useState(true);
  const [txCycles, setTxCycles] = useState("1");
  const [useMiles, setUseMiles] = useState(true);
  const [dxOnly, setDxOnly] = useState(false);
  const [minDistance, setMinDistance] = useState("");
  const [directionOnly, setDirectionOnly] = useState(false);
  const [azimuthDeg, setAzimuthDeg] = useState("");
  const [beamWidthDeg, setBeamWidthDeg] = useState("");
  const [clearData, setClearData] = useState(false);

  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [spots, setSpots] = useState<SpotResult[]>([]);
  const [ageText, setAgeText] = useState("");

  const dict1Ref = useRef<ReportDict>(new Map());
  const dict2Ref = useRef<ReportDict>(new Map());
  const dict1TimeRef = useRef<Date | null>(null);
  const dict2TimeRef = useRef<Date | null>(null);

  const clearDicts = useCallback(() => {
    dict1Ref.current = new Map();
    dict2Ref.current = new Map();
    dict1TimeRef.current = null;
    dict2TimeRef.current = null;
  }, []);

  // Age timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (dict1Ref.current.size === 0 && dict2Ref.current.size === 0) {
        setAgeText("");
        return;
      }
      const t1 = dict1TimeRef.current;
      const t2 = dict2TimeRef.current;
      const sec1 = t1 ? (Date.now() - t1.getTime()) / 1000 : 0;
      const sec2 = t2 ? (Date.now() - t2.getTime()) / 1000 : 0;
      const sec = Math.max(sec1, sec2);
      const min = Math.floor(sec / 60);
      if (min <= 1) {
        setAgeText("");
        return;
      }
      const s = min <= 60 ? `${min}` : "60+";
      setAgeText(`(${s} minutes old)`);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Clear cache when band, mode, or period changes
  useEffect(() => { clearDicts(); }, [band, mode, periodMins, clearDicts]);

  const handleCall1Change = (val: string) => {
    setCall1(val);
    dict1Ref.current = new Map();
    dict1TimeRef.current = null;
  };

  const handleCall2Change = (val: string) => {
    setCall2(val);
    dict2Ref.current = new Map();
    dict2TimeRef.current = null;
  };

  async function fetchReports(
    callsign: string,
    period: string,
    modeVal: string,
    bandVal: string
  ): Promise<ReceptionReport[]> {
    let res: Response;
    if (modeVal === "WSPR") {
      const params = new URLSearchParams({ callsign, period, band: bandVal });
      res = await fetch(`/api/wsprnet?${params}`);
    } else {
      const params = new URLSearchParams({ callsign, period, mode: modeVal, band: bandVal });
      res = await fetch(`/api/pskreporter?${params}`);
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data.reports;
  }

  async function handleCompare() {
    // Validation
    const c1 = call1.trim().toUpperCase();
    if (!c1 || c1.length < 3) { setStatusText("Enter 'Call sign 1'"); return; }
    setCall1(c1);

    const c2 = call2.trim().toUpperCase();
    if (!c2 || c2.length < 3) { setStatusText("Enter 'Call sign 2'"); return; }
    setCall2(c2);

    if (c1 === c2) { setStatusText("Call signs must be different"); return; }

    const sourceName = mode === "WSPR" ? "WSPRnet" : "PSKReporter";

    let minDistKm = 0;
    if (dxOnly) {
      const maxDist = useMiles ? 12500 : 20000;
      const minDist = parseInt(minDistance.trim(), 10);
      if (isNaN(minDist) || minDist < 0 || minDist > maxDist) {
        setStatusText(`Enter a number for DX 'Minimum Distance' between 0 and ${maxDist}`);
        return;
      }
      minDistKm = useMiles ? minDist * 1.60934 : minDist;
    }

    let azVal = 0;
    let bwVal = 360;
    if (directionOnly) {
      azVal = parseInt(azimuthDeg.trim(), 10);
      if (isNaN(azVal) || azVal < 0 || azVal > 359) {
        setStatusText("Enter a number between 0 and 359 for 'Azimuth'");
        return;
      }
      bwVal = parseInt(beamWidthDeg.trim(), 10);
      if (isNaN(bwVal) || bwVal < 0 || bwVal > 360) {
        setStatusText("Enter a number between 0 and 360 for 'Width'");
        return;
      }
    }

    if (!band) { setStatusText("Select a Band"); return; }

    const pMins = parseFloat(periodMins.trim());
    if (isNaN(pMins) || pMins < 0 || pMins > 60) {
      setStatusText("Enter a number of minutes between 0 and 60");
      return;
    }

    let maxTimeDiff = mode === "WSPR" ? 130 : 10;
    let txCyclesVal = 1;
    if (!twoTransmitters) {
      txCyclesVal = parseInt(txCycles.trim(), 10);
      if (isNaN(txCyclesVal) || txCyclesVal < 1 || txCyclesVal > 10) {
        setStatusText("Enter a number of Tx cycles between 1 and 10");
        return;
      }
      const cycleTime = mode === "WSPR" ? 120 : mode === "FT8" ? 30 : 15;
      maxTimeDiff = txCyclesVal * (2 * cycleTime) + 10;
    }

    setSpots([]);
    setBusy(true);
    setStatusText("");

    if (clearData) {
      clearDicts();
      setClearData(false);
    }

    const period = Math.round(pMins * -60).toString();

    try {
      // Fetch call1 data if not cached
      if (dict1Ref.current.size === 0) {
        setStatusText(`Querying ${sourceName} for ${c1}...`);
        const reports1 = await fetchReports(c1, period, mode, band);
        dict1Ref.current = buildReportDict(reports1);

        if (dict1Ref.current.size === 0) {
          setStatusText(`No ${sourceName} spots found for ${c1}`);
          return;
        }
        dict1TimeRef.current = new Date();
        setStatusText(`${dict1Ref.current.size} ${sourceName} spots found for ${c1}...`);
        // Rate limit delay
        const delay1 = mode === "WSPR" ? 3500 : 6000;
        await new Promise((r) => setTimeout(r, delay1));
      }

      // Fetch call2 data if not cached
      if (dict2Ref.current.size === 0) {
        setStatusText(`Querying ${sourceName} for ${c2}...`);
        const reports2 = await fetchReports(c2, period, mode, band);
        dict2Ref.current = buildReportDict(reports2);

        if (dict2Ref.current.size === 0) {
          setStatusText(`No ${sourceName} spots found for ${c2}`);
          return;
        }
        dict2TimeRef.current = new Date();
        setStatusText(`${dict2Ref.current.size} ${sourceName} spots found for ${c2}...`);
        await new Promise((r) => setTimeout(r, 2000));
      }

      // Compare
      const result: CompareResult = compareAntennas(
        dict1Ref.current,
        dict2Ref.current,
        { maxTimeDiff, minDistKm, azimuthDeg: azVal, beamWidth: bwVal, useMiles }
      );

      setSpots(result.spots);

      if (result.spotCount > 0) {
        if (result.avgSnrDelta >= 0) {
          setStatusText(
            `${c1} better than ${c2} by ${result.avgSnrDelta.toFixed(2)} dB (avg).\n${result.spotCount} spots processed.`
          );
        } else {
          setStatusText(
            `${c2} better than ${c1} by ${Math.abs(result.avgSnrDelta).toFixed(2)} dB (avg).\n${result.spotCount} spots processed.`
          );
        }
      } else {
        const opt = dxOnly || directionOnly ? " or DX/direction" : "";
        const desc = twoTransmitters
          ? "No simultaneous spot pairs"
          : `No spot pairs within ${txCyclesVal} Tx cycle(s)`;
        setStatusText(`${desc} (refine time${opt} options?)`);
      }
    } catch (err) {
      setStatusText(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 font-sans bg-gray-800 text-gray-100 rounded-lg shadow-lg">
      <h1 className="text-xl font-bold mb-4 text-white">Antenna Compare v2.0</h1>

      {/* Call signs */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm font-medium text-gray-300">Call sign 1:</label>
          <input
            type="text"
            value={call1}
            onChange={(e) => handleCall1Change(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-28 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-24 text-sm font-medium text-gray-300">Call sign 2:</label>
          <input
            type="text"
            value={call2}
            onChange={(e) => handleCall2Change(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-28 text-sm"
          />
        </div>
      </div>

      {/* Band */}
      <div className="flex items-center gap-2 mb-2">
        <label className="w-24 text-sm font-medium text-gray-300">Band:</label>
        <select
          value={band}
          onChange={(e) => setBand(e.target.value)}
          className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-28 text-sm"
        >
          <option value="">--</option>
          {BANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* Mode */}
      <div className="flex items-center gap-2 mb-2">
        <label className="w-24 text-sm font-medium text-gray-300">Mode:</label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={mode === "FT8"}
            onChange={() => setMode("FT8")}
            className="accent-blue-500"
          />
          FT8
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={mode === "FT4"}
            onChange={() => setMode("FT4")}
            className="accent-blue-500"
          />
          FT4
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={mode === "WSPR"}
            onChange={() => setMode("WSPR")}
            className="accent-blue-500"
          />
          WSPR
        </label>
      </div>

      {/* Time */}
      <div className="flex items-center gap-2 mb-3">
        <label className="w-24 text-sm font-medium text-gray-300">Time:</label>
        <span className="text-sm text-gray-300">Last</span>
        <input
          type="text"
          value={periodMins}
          onChange={(e) => setPeriodMins(e.target.value)}
          className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-12 text-sm"
        />
        <span className="text-sm text-gray-300">minutes</span>
      </div>

      <hr className="my-3 border-gray-600" />

      {/* Transmitter mode */}
      <div className="space-y-1 mb-2">
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={twoTransmitters}
            onChange={() => setTwoTransmitters(true)}
            className="accent-blue-500"
          />
          2 transmitters (max precision)
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={!twoTransmitters}
            onChange={() => setTwoTransmitters(false)}
            className="accent-blue-500"
          />
          1 transmitter + antenna switch
        </label>
      </div>

      {/* TX cycles (visible when 1 transmitter) */}
      {!twoTransmitters && (
        <div className="flex items-center gap-2 mb-2 ml-6">
          <span className="text-sm text-gray-300">Switch every</span>
          <input
            type="text"
            value={txCycles}
            onChange={(e) => setTxCycles(e.target.value)}
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-12 text-sm"
          />
          <span className="text-sm text-gray-300">Tx cycles</span>
        </div>
      )}

      {/* Units */}
      <div className="flex items-center gap-2 mb-2">
        <label className="w-24 text-sm font-medium text-gray-300">Units:</label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={useMiles}
            onChange={() => setUseMiles(true)}
            className="accent-blue-500"
          />
          miles
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="radio"
            checked={!useMiles}
            onChange={() => setUseMiles(false)}
            className="accent-blue-500"
          />
          km
        </label>
      </div>

      {/* DX filter */}
      <div className="mb-2">
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={dxOnly}
            onChange={(e) => setDxOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Compare DX only:
        </label>
        {dxOnly && (
          <div className="flex items-center gap-2 ml-6 mt-1">
            <span className="text-sm text-gray-300">Minimum distance:</span>
            <input
              type="text"
              value={minDistance}
              onChange={(e) => setMinDistance(e.target.value)}
              className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-20 text-sm"
            />
          </div>
        )}
      </div>

      {/* Direction filter */}
      <div className="mb-3">
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={directionOnly}
            onChange={(e) => setDirectionOnly(e.target.checked)}
            className="accent-blue-500"
          />
          Compare specific direction only:
        </label>
        {directionOnly && (
          <div className="space-y-1 ml-6 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-sm w-28 text-gray-300">Azimuth (deg):</span>
              <input
                type="text"
                value={azimuthDeg}
                onChange={(e) => setAzimuthDeg(e.target.value)}
                className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-20 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm w-28 text-gray-300">Width (deg):</span>
              <input
                type="text"
                value={beamWidthDeg}
                onChange={(e) => setBeamWidthDeg(e.target.value)}
                className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 w-20 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clear data + age */}
      <div className="flex items-center gap-3 mb-2">
        <label className="flex items-center gap-1 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={clearData}
            onChange={(e) => setClearData(e.target.checked)}
            className="accent-blue-500"
          />
          {mode === "WSPR" ? "Clear WSPR data" : "Clear PSKR data"}
        </label>
        {ageText && <span className="text-sm text-gray-400">{ageText}</span>}
      </div>

      <hr className="my-3 border-gray-600" />

      {/* Compare button */}
      <div className="mb-4">
        <button
          onClick={handleCompare}
          disabled={busy}
          className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {busy ? "Comparing..." : "Compare"}
        </button>
      </div>

      {/* Results header */}
      {spots.length > 0 && (
        <>
          <div
            style={{ fontFamily: "'Consolas', 'Courier New', monospace", whiteSpace: "pre" }}
            className="text-sm text-gray-400 mb-1"
          >
            {"DX call     \u0394SNR   Dist   Az"}
          </div>
          <div
            style={{ fontFamily: "'Consolas', 'Courier New', monospace", whiteSpace: "pre" }}
            className="border border-gray-600 rounded bg-gray-900 text-green-400 text-sm h-32 overflow-y-auto p-1 mb-3"
          >
            {spots.map((s, i) => (
              <div key={i}>
                {s.dxCall.padEnd(10)}
                {String(s.snrDelta).padStart(6)}
                {Math.round(s.distanceVal).toString().padStart(7)}
                {Math.round(s.azimuthVal).toString().padStart(5)}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Status / result text */}
      {statusText && (
        <div className="border border-gray-600 rounded bg-gray-700 text-gray-100 p-2 text-sm whitespace-pre-wrap">
          {statusText}
        </div>
      )}
    </div>
  );
}
