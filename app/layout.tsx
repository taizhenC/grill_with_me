import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "grill-with-me",
  description:
    "Grill a whole team about their project, then hold everyone to the contract that comes out of it.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
