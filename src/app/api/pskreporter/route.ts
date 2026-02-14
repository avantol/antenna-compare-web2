import { NextRequest, NextResponse } from "next/server";
import { freqToBand } from "@/lib/bands";
import type { ReceptionReport } from "@/lib/types";
export type { ReceptionReport } from "@/lib/types";

function extractAttr(name: string, line: string): string | null {
  const search = `${name}="`;
  const i = line.indexOf(search);
  if (i < 0) return null;
  const start = i + search.length;
  const j = line.indexOf('"', start);
  if (j < 0) return null;
  return line.substring(start, j);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign");
  const period = searchParams.get("period");
  const mode = searchParams.get("mode");
  const band = searchParams.get("band");

  if (!callsign || !period || !mode || !band) {
    return NextResponse.json(
      { error: "Missing required parameters: callsign, period, mode, band" },
      { status: 400 }
    );
  }

  try {
    const url = `https://retrieve.pskreporter.info/query?senderCallsign=${encodeURIComponent(callsign)}&flowStartSeconds=${period}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Connection: "close" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 503) {
        return NextResponse.json(
          { error: "Too many requests to PSKReporter. Wait and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `Query failure, status code: ${response.status}` },
        { status: response.status }
      );
    }

    const text = await response.text();
    const lines = text.split("\n");
    const reports: ReceptionReport[] = [];
    let endDetected = false;

    for (const line of lines) {
      const sender = extractAttr("senderCallsign", line);
      if (sender === callsign) {
        const recvr = extractAttr("receiverCallsign", line);
        const snrStr = extractAttr("sNR", line);
        const sec = extractAttr("flowStartSeconds", line);
        const f = extractAttr("frequency", line);
        const m = extractAttr("mode", line);
        const rl = extractAttr("receiverLocator", line);
        const sl = extractAttr("senderLocator", line);

        let b = "unk";
        if (f != null) {
          b = freqToBand(parseFloat(f) / 1e6);
        }

        if (
          recvr && snrStr && sec && rl && rl.length >= 4 &&
          sl && sl.length >= 4 && m === mode && b === band
        ) {
          reports.push({
            receiverCallsign: recvr,
            snr: parseInt(snrStr, 10),
            flowStartSeconds: parseInt(sec, 10),
            receiverLocator: rl.substring(0, 4),
            senderLocator: sl.substring(0, 4),
          });
        }
      }

      if (line.includes("</receptionReports>")) {
        endDetected = true;
        break;
      }
    }

    if (!endDetected) {
      return NextResponse.json(
        { error: "Unexpected response format from PSKReporter, try again" },
        { status: 502 }
      );
    }

    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Query failure from PSKReporter: ${message}` },
      { status: 500 }
    );
  }
}