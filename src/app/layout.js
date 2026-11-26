import InteractiveBackground from "@/components/ui/InteractiveBackground";
import "./globals.css";

export const metadata = {
  title: "NXT Financial Group — Build Your Financial Legacy",
  description: "Join a North American financial powerhouse. Experience the unique Tribrid MGA model designed for agent success.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main style={{ position: 'relative', zIndex: 1, minHeight: '100vh', backgroundColor: 'transparent' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
