'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import PdfUploader from './PdfUploader';
import { PATTERN_CATEGORIES } from '@/lib/patternUtils';

export default function PdfList({ newDocument, onUploadSuccess }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

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

  // Update the useEffect for newDocument handling
  useEffect(() => {
    if (newDocument) {
      const updateDocuments = async () => {
        console.log('Updating documents with:', newDocument); // Debug log

        if (newDocument.id.startsWith('temp-')) {
          // For optimistic updates
          setDocuments(prev => [newDocument, ...prev]);
        } else {
          // For real document updates, preserve the display_title
          const docWithUrl = await addSignedUrl(newDocument);
          setDocuments(prev => {
            // Remove any temporary version and add the real document
            const filtered = prev.filter(doc => 
              doc.id !== `temp-${newDocument.file_name}` && doc.id !== newDocument.id
            );
            
            // Preserve the display_title from newDocument
            const finalDoc = {
              ...docWithUrl,
              display_title: newDocument.display_title // Ensure we keep the display_title
            };
            
            console.log('Final document:', finalDoc); // Debug log
            return [finalDoc, ...filtered];
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

  // Filter documents based on selected category
  const filteredDocuments = documents.filter(doc => {
    if (selectedCategory === 'ALL') return true;
    return doc.category === selectedCategory;
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {/* Category Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-4 py-2 rounded-full transition-colors ${
            selectedCategory === 'ALL'
              ? 'bg-[var(--mainheader)] text-white'
              : 'bg-[var(--background)] border border-[var(--mainheader)] text-[var(--mainheader)] hover:bg-[var(--mainheader)]/10'
          }`}
        >
          All Patterns
        </button>
        {Object.entries(PATTERN_CATEGORIES).map(([category, config]) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-full transition-colors ${
              selectedCategory === category
                ? 'bg-[var(--mainheader)] text-white'
                : 'bg-[var(--background)] border border-[var(--mainheader)] text-[var(--mainheader)] hover:bg-[var(--mainheader)]/10'
            }`}
          >
            {config.name}
          </button>
        ))}
      </div>

      {filteredDocuments.length === 0 ? (
        <p className="text-center mt-8">
          {selectedCategory === 'ALL' 
            ? 'No documents uploaded yet'
            : 'No documents in this category'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredDocuments.map((doc) => (
            <div key={doc.id} className="flex flex-col items-center">
              <Link href={`/pdf/${doc.id}`} className="mb-3">
                <div className="w-48 h-48 relative">
                  <svg
                    viewBox="0 0 200 200"
                    className="w-full h-full absolute top-0 left-0"
                  >
                    <defs>
                      <clipPath id={`blob-shape-${doc.id}`}>
                        <path
                          d="M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z"
                          transform="translate(100 100)"
                        />
                      </clipPath>
                    </defs>
                    <path
                      d="M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z"
                      transform="translate(100 100)"
                      fill="var(--background)"
                      className="drop-shadow-md"
                    />
                  </svg>
                  <div 
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `url(#blob-shape-${doc.id})` }}
                  >
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
                </div>
              </Link>
              <Link href={`/pdf/${doc.id}`} className="text-center">
                <h3 className="text-lg font-normal">
                  {doc.display_title || doc.file_name.replace(/\.pdf$/i, '')}
                </h3>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 