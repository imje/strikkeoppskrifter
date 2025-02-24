import { Inter } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import Auth from '@/components/Auth';

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
          <div className="fixed top-4 right-4 flex items-center gap-12">
            <div className="relative">
              <Auth />
            </div>
            <div className="relative">
              <ThemeToggle />
            </div>
          </div>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
