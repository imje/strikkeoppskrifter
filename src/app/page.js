'use client';

import { useState } from 'react';
import PdfUploader from '@/components/PdfUploader';
import PdfList from '@/components/PdfList';
import Auth from '@/components/Auth';

export default function Home() {
  const [newDocument, setNewDocument] = useState(null);

  const handleUploadSuccess = (doc) => {
    setNewDocument(doc);
  };

  return (
    <>
      {/* PDF Upload Section */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Last opp ny pdf</h2>
        <PdfUploader onUploadSuccess={handleUploadSuccess} />
      </section>

      {/* PDF List Section */}
      <section>
        <PdfList newDocument={newDocument} />
      </section>
    </>
  );
}
