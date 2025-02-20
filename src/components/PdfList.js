'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function PdfList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        // Fetch documents
        const { data: docs, error } = await supabase
          .from('pdf_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Get signed URLs for thumbnails
        const docsWithUrls = await Promise.all(
          docs.map(async (doc) => {
            if (doc.thumbnail_path) {
              const { data } = await supabase.storage
                .from('pdfs')
                .createSignedUrl(doc.thumbnail_path, 60 * 60); // 1 hour expiry

              return {
                ...doc,
                thumbnailUrl: data?.signedUrl
              };
            }
            return doc;
          })
        );

        setDocuments(docsWithUrls);
        console.log('Documents with URLs:', docsWithUrls); // Debug log
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const downloadPdf = async (filePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('pdfs')
        .download(filePath);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filePath.split('/').pop();
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4">Your Documents</h2>
      {documents.length === 0 ? (
        <p>No documents uploaded yet</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <li key={doc.id} className="p-4 border rounded-lg hover:shadow-lg transition-shadow">
              <Link href={`/pdf/${doc.id}`}>
                <div className="cursor-pointer">
                  <div className="aspect-w-3 aspect-h-4 bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    {doc.thumbnailUrl ? (
                      <div className="relative w-full h-32">
                        <Image
                          src={doc.thumbnailUrl}
                          alt={doc.file_name}
                          fill
                          style={{ objectFit: 'contain' }}
                          priority
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-32">
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <h3 className="font-medium truncate">{doc.file_name}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 