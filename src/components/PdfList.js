'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import PdfUploader from './PdfUploader';

export default function PdfList({ newDocument, onUploadSuccess }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const addSignedUrl = async (doc) => {
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
  };

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const { data: docs, error } = await supabase
          .from('pdf_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const docsWithUrls = await Promise.all(docs.map(addSignedUrl));
        setDocuments(docsWithUrls);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Add new document to the list when it's uploaded
  useEffect(() => {
    if (newDocument) {
      const updateDocuments = async () => {
        // If it's an optimistic document (has temp- prefix)
        if (newDocument.id.startsWith('temp-')) {
          setDocuments(prev => [newDocument, ...prev]);
        } else {
          // Real document with thumbnail
          const docWithUrl = await addSignedUrl(newDocument);
          setDocuments(prev => {
            // Remove optimistic version if it exists
            const filtered = prev.filter(doc => !doc.id.startsWith('temp-'));
            return [docWithUrl, ...filtered];
          });
        }
      };
      updateDocuments();
    }
  }, [newDocument]);

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
      {documents.length === 0 ? (
        <p>No documents uploaded yet</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {documents.map((doc) => (
            <div key={doc.id} className="flex flex-col items-center">
              <Link href={`/pdf/${doc.id}`} className="mb-3">
                <div className="w-48 h-48 rounded-full overflow-hidden bg-gray-100">
                  {doc.thumbnailUrl ? (
                    <Image
                      src={doc.thumbnailUrl}
                      alt={doc.file_name}
                      width={192}
                      height={192}
                      style={{ objectFit: 'cover' }}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
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
              </Link>
              <Link href={`/pdf/${doc.id}`} className="text-center">
                <h3 className="text-lg font-normal">{doc.file_name}</h3>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 