'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PdfList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDoc, setExpandedDoc] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const { data, error } = await supabase
          .from('pdf_documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setDocuments(data || []);
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
        <ul className="space-y-4">
          {documents.map((doc) => (
            <li key={doc.id} className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium">{doc.file_name}</span>
                <div className="space-x-2">
                  <button
                    onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    {expandedDoc === doc.id ? 'Hide Text' : 'Show Text'}
                  </button>
                  <button
                    onClick={() => downloadPdf(doc.file_path)}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Download
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Uploaded on {new Date(doc.created_at).toLocaleDateString()}
              </p>
              {expandedDoc === doc.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-bold mb-2">Extracted Text:</h3>
                  <p className="whitespace-pre-wrap text-sm">{doc.extracted_text}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 