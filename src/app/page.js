import PdfUploader from '@/components/PdfUploader';
import PdfList from '@/components/PdfList';
import Auth from '@/components/Auth';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Mine strikkeoppskrifter</h1>
        
        {/* Auth Section */}
        <section className="mb-8">
          <Auth />
        </section>

        {/* PDF Upload Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Last opp ny pdf</h2>
          <PdfUploader />
        </section>

        {/* PDF List Section */}
        <section>
          <PdfList />
        </section>
      </main>
    </div>
  );
}
