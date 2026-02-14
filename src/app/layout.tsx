import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antenna Compare",
  description: "Compare amateur radio antenna performance using PSKReporter data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
