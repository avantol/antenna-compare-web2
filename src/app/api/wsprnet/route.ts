import { NextRequest, NextResponse } from "next/server";
import { WSPR_BAND_MAP } from "@/lib/bands";
import type { ReceptionReport } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign");
  const period = searchParams.get("period");
  const band = searchParams.get("band");

  if (!callsign || !period || !band) {
    return NextResponse.json(
      { error: "Missing required parameters: callsign, period, band" },
      { status: 400 }
    );
  }

  if (!/^[A-Z0-9\/]+$/i.test(callsign)) {
    return NextResponse.json(
      { error: "Invalid callsign" },
      { status: 400 }
    );
  }

  const wsprBand = WSPR_BAND_MAP[band];
  if (wsprBand === undefined) {
    return NextResponse.json(
      { error: `Unsupported band for WSPR: ${band}` },
      { status: 400 }
    );
  }

  const secondsAgo = Math.abs(parseInt(period, 10));
  if (isNaN(secondsAgo) || secondsAgo <= 0) {
    return NextResponse.json(
      { error: "Invalid period parameter" },
      { status: 400 }
    );
  }

  const sql = `
    SELECT rx_sign, rx_loc, tx_loc, snr, time
    FROM wspr.rx
    WHERE tx_sign = '${callsign.replace(/'/g, "''")}'
      AND band = ${wsprBand}
      AND time >= now() - INTERVAL ${secondsAgo} SECOND
    FORMAT JSON
  `;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const url = `https://db1.wspr.live/?query=${encodeURIComponent(sql.trim())}`;
    const response = await fetch(url, { signal: controller.signal });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Too many requests to wspr.live. Wait and try again." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: `wspr.live query failure, status: ${response.status}` },
        { status: response.status }
      );
    }

    const json = await response.json();
    const rows = json.data || [];

    const reports: ReceptionReport[] = [];
    for (const row of rows) {
      const rxLoc = (row.rx_loc || "").substring(0, 4);
      const txLoc = (row.tx_loc || "").substring(0, 4);

      if (row.rx_sign && rxLoc.length >= 4 && txLoc.length >= 4) {
        const epochSeconds = Math.floor(new Date(row.time + "Z").getTime() / 1000);

        reports.push({
          receiverCallsign: row.rx_sign,
          snr: row.snr,
          flowStartSeconds: epochSeconds,
          receiverLocator: rxLoc,
          senderLocator: txLoc,
        });
      }
    }

    return NextResponse.json({ reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `wspr.live query failure: ${message}` },
      { status: 500 }
    );
  }
}
