import { Inter } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: "Mine Strikkeoppskrifter",
  description: "Samle alle dine strikkeoppskrifter på en plass",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
