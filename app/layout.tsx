import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DormScout \u2014 Student dorm reviews",
  description:
    "The quiet floors. The good showers. The stuff you only learn after move-in.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
