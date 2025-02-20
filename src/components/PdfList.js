'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function PdfList() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

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
                <span>{doc.file_name}</span>
                <button
                  onClick={() => downloadPdf(doc.file_path)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Download
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Uploaded on {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
} 