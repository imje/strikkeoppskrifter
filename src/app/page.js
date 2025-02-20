'use client';

import PdfUploader from '@/components/PdfUploader';
import PdfList from '@/components/PdfList';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">PDF Upload and Management</h1>
        
        {/* PDF Upload Section */}
        <section className="mb-8">
          <h2 className="text-xl font-bold mb-4">Upload New PDF</h2>
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
