import { Inter, Playfair_Display } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from '@/components/ThemeProvider';
import ThemeToggle from '@/components/ThemeToggle';
import Auth from '@/components/Auth';

const inter = Inter({ subsets: ['latin'] })
const playfair = Playfair_Display({ 
  subsets: ['latin'],
  display: 'swap',
})

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
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className={`${playfair.className} text-4xl font-bold mb-8`}>
              Mine strikkeoppskrifter
            </h1>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
