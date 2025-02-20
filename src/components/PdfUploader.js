'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfUploader() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Get current user
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };

    getCurrentUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const extractText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const handleFileUpload = async (e) => {
    try {
      if (!user) {
        alert('Please log in to upload documents');
        return;
      }

      setLoading(true);
      const file = e.target.files[0];
      if (!file || !file.type.includes('pdf')) {
        alert('Please upload a PDF file');
        return;
      }

      // Extract text from PDF
      const extractedText = await extractText(file);
      setText(extractedText);

      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store document metadata in the database
      const { error: dbError } = await supabase
        .from('pdf_documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          extracted_text: extractedText
        });

      if (dbError) throw dbError;
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing PDF');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div>Please log in to upload documents</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="mb-4"
        disabled={loading}
      />
      {loading && <p>Processing...</p>}
      {text && (
        <div className="mt-4 p-4 border rounded-lg">
          <h3 className="font-bold mb-2">Extracted Text:</h3>
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      )}
    </div>
  );
} 