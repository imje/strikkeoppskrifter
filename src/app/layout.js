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
          <div className="max-w-5xl mx-auto px-8 sm:px-12 lg:px-16 py-12">
            <div className="flex justify-between items-center mb-12">
              <h1 className={`${playfair.className} text-4xl font-bold`}>
                Mine strikkeoppskrifter
              </h1>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <Auth />
              </div>
            </div>
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
