// Port of Grid.cs - Maidenhead locator utilities
// Original: Copyright (c) 2011, Yves Goergen

function degToRad(deg: number): number {
  return (deg / 180) * Math.PI;
}

function radToDeg(rad: number): number {
  return (rad / Math.PI) * 180;
}

export function locatorToLatLng(locator: string): { lat: number; lon: number } {
  locator = locator.trim().toUpperCase();

  if (/^[A-R]{2}[0-9]{2}$/.test(locator)) {
    const lon =
      (locator.charCodeAt(0) - 65) * 20 +
      (locator.charCodeAt(2) - 48 + 0.5) * 2 -
      180;
    const lat =
      (locator.charCodeAt(1) - 65) * 10 +
      (locator.charCodeAt(3) - 48 + 0.5) -
      90;
    return { lat, lon };
  } else if (/^[A-R]{2}[0-9]{2}[A-X]{2}$/.test(locator)) {
    const lon =
      (locator.charCodeAt(0) - 65) * 20 +
      (locator.charCodeAt(2) - 48) * 2 +
      (locator.charCodeAt(4) - 65 + 0.5) / 12 -
      180;
    const lat =
      (locator.charCodeAt(1) - 65) * 10 +
      (locator.charCodeAt(3) - 48) +
      (locator.charCodeAt(5) - 65 + 0.5) / 24 -
      90;
    return { lat, lon };
  } else if (/^[A-R]{2}[0-9]{2}[A-X]{2}[0-9]{2}$/.test(locator)) {
    const lon =
      (locator.charCodeAt(0) - 65) * 20 +
      (locator.charCodeAt(2) - 48) * 2 +
      (locator.charCodeAt(4) - 65) / 12 +
      (locator.charCodeAt(6) - 48 + 0.5) / 120 -
      180;
    const lat =
      (locator.charCodeAt(1) - 65) * 10 +
      (locator.charCodeAt(3) - 48) +
      (locator.charCodeAt(5) - 65) / 24 +
      (locator.charCodeAt(7) - 48 + 0.5) / 240 -
      90;
    return { lat, lon };
  } else if (/^[A-R]{2}[0-9]{2}[A-X]{2}[0-9]{2}[A-X]{2}$/.test(locator)) {
    const lon =
      (locator.charCodeAt(0) - 65) * 20 +
      (locator.charCodeAt(2) - 48) * 2 +
      (locator.charCodeAt(4) - 65) / 12 +
      (locator.charCodeAt(6) - 48) / 120 +
      (locator.charCodeAt(8) - 65 + 0.5) / 120 / 24 -
      180;
    const lat =
      (locator.charCodeAt(1) - 65) * 10 +
      (locator.charCodeAt(3) - 48) +
      (locator.charCodeAt(5) - 65) / 24 +
      (locator.charCodeAt(7) - 48) / 240 +
      (locator.charCodeAt(9) - 65 + 0.5) / 240 / 24 -
      90;
    return { lat, lon };
  }

  throw new Error("Invalid locator format");
}

export function distance(a: string, b: string): number {
  const posA = locatorToLatLng(a);
  const posB = locatorToLatLng(b);

  const hn = degToRad(posA.lat);
  const he = degToRad(posA.lon);
  const n = degToRad(posB.lat);
  const e = degToRad(posB.lon);

  const co =
    Math.cos(he - e) * Math.cos(hn) * Math.cos(n) +
    Math.sin(hn) * Math.sin(n);

  if (Math.abs(co) >= 1) return 0;

  let ca = Math.atan(Math.abs(Math.sqrt(1 - co * co) / co));
  if (co < 0) ca = Math.PI - ca;

  return 6367 * ca;
}

export function azimuth(a: string, b: string): number {
  const posA = locatorToLatLng(a);
  const posB = locatorToLatLng(b);

  const hn = degToRad(posA.lat);
  const he = degToRad(posA.lon);
  const n = degToRad(posB.lat);
  const e = degToRad(posB.lon);

  const co =
    Math.cos(he - e) * Math.cos(hn) * Math.cos(n) +
    Math.sin(hn) * Math.sin(n);

  if (Math.abs(co) >= 1) return 0;

  let ca = Math.atan(Math.abs(Math.sqrt(1 - co * co) / co));
  if (co < 0) ca = Math.PI - ca;

  const si = Math.sin(e - he) * Math.cos(n) * Math.cos(hn);
  const co2 = Math.sin(n) - Math.sin(hn) * Math.cos(ca);
  let az = Math.atan(Math.abs(si / co2));
  if (co2 < 0) az = Math.PI - az;
  if (si < 0) az = -az;
  if (az < 0) az = az + 2 * Math.PI;

  return radToDeg(az);
}
