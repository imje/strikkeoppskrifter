'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export default function PdfPage() {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const params = useParams();

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const { data, error } = await supabase
          .from('pdf_documents')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setDocument(data);
      } catch (error) {
        console.error('Error fetching document:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!document) return <div>Document not found</div>;

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{document.file_name}</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-4">
            Uploaded on {new Date(document.created_at).toLocaleDateString()}
          </p>
          <h2 className="text-xl font-bold mb-4">Extracted Text</h2>
          <div className="prose max-w-none">
            {document.extracted_text.split('\n\n').map((section, index) => (
              <div key={index} className="mb-4">
                <p className="whitespace-pre-wrap">{section}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
} 