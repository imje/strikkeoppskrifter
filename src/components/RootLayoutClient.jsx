'use client';

import { Inter, Playfair_Display } from 'next/font/google'
import ThemeToggle from '@/components/ThemeToggle';
import Auth from '@/components/Auth';
import PdfUploader from '@/components/PdfUploader';

const inter = Inter({ subsets: ['latin'] })
const playfair = Playfair_Display({ 
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayoutClient({ children }) {
  return (
    <div className="max-w-5xl mx-auto px-8 sm:px-12 lg:px-16 py-12">
      <div className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <h1 className={`${playfair.className} text-4xl font-bold`}>
            Mine strikkeoppskrifter
          </h1>
          <PdfUploader />
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Auth />
        </div>
      </div>
      {children}
    </div>
  );
} 