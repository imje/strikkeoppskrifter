'use client';

import { useState } from 'react';
import PdfList from '@/components/PdfList';
import PdfUploader from '@/components/PdfUploader';

export default function Home() {
  const [newDocument, setNewDocument] = useState(null);

  const handleUploadSuccess = (doc) => {
    setNewDocument(doc);
  };

  return (
    <section>
      <div className="flex items-center gap-4 mb-8">
        <h2 className="text-2xl font-bold">Strikkeoppskrifter</h2>
        <PdfUploader onUploadSuccess={handleUploadSuccess} />
      </div>
      <PdfList newDocument={newDocument} onUploadSuccess={handleUploadSuccess} />
    </section>
  );
}
