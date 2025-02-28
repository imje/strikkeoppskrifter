import { Playfair_Display } from 'next/font/google';
import Auth from './Auth';

const playfair = Playfair_Display({ 
  subsets: ['latin'],
  display: 'swap',
});

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className={`${playfair.className} text-4xl tracking-tight font-extrabold sm:text-5xl md:text-6xl`}>
                  <span className="block text-[var(--mainheader)]">Samle alle dine</span>
                  <span className="block text-[var(--accent)] mt-3">strikkeoppskrifter</span>
                </h1>
                <p className="mt-3 text-base sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto lg:mx-0">
                  Organiser og få tilgang til alle dine strikkeoppskrifter på ett sted. 
                  Last opp PDF-filer, kategoriser dem, og få en oversiktlig visning av størrelser og mål.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <Auth className="w-full flex items-center justify-center px-8 py-3 text-base font-medium rounded-md text-white bg-[var(--mainheader)] hover:bg-[var(--mainheader)]/90" />
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-[var(--background)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
              {/* Feature 1 */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-[var(--accent)] text-white">
                    📁
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium">Enkel opplasting</p>
                </dt>
                <dd className="mt-2 ml-16 text-base">
                  Last opp dine PDF-filer med ett klikk og få dem automatisk organisert.
                </dd>
              </div>

              {/* Feature 2 */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-[var(--accent)] text-white">
                    🔍
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium">Smart kategorisering</p>
                </dt>
                <dd className="mt-2 ml-16 text-base">
                  Automatisk kategorisering av oppskrifter basert på innhold.
                </dd>
              </div>

              {/* Feature 3 */}
              <div className="relative">
                <dt>
                  <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-[var(--accent)] text-white">
                    📏
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium">Størrelsesguide</p>
                </dt>
                <dd className="mt-2 ml-16 text-base">
                  Se alle mål og størrelser i en oversiktlig visning.
                </dd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 