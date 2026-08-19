import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "grill-with-me",
    template: "%s · grill-with-me",
  },
  description:
    "Grill a whole team about their project — each member in their own CLI, with their own AI — then hold everyone to the contract that comes out of it.",
  applicationName: "grill-with-me",
  openGraph: {
    siteName: "grill-with-me",
    type: "website",
    description:
      "Ten minutes each, in your own editor. One contract everyone codes against.",
  },
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
