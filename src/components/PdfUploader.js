'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Dynamically import PDF.js only on client side
const initPdfLib = async () => {
  if (typeof window === 'undefined') return null;
  const pdfjsLib = await import('pdfjs-dist/build/pdf');
  const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.entry');
  
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  return pdfjsLib;
};

export default function PdfUploader() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Initialize PDF.js when component mounts
    initPdfLib().catch(console.error);
    
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
    const pdfjsLib = await initPdfLib();
    if (!pdfjsLib) {
      throw new Error('PDF.js failed to initialize');
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
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

      console.log('Starting PDF processing...');

      // Extract text from PDF
      let extractedText;
      try {
        extractedText = await extractText(file);
        console.log('Text extracted successfully:', extractedText.substring(0, 100) + '...');
        setText(extractedText);
      } catch (extractError) {
        console.error('Error extracting text:', extractError);
        throw new Error('Failed to extract text from PDF');
      }

      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `${user.id}/${fileName}`;
      
      console.log('Uploading to Supabase storage...');
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw uploadError;
      }
      console.log('File uploaded successfully');

      // Store document metadata in the database
      console.log('Saving to database...');
      const { error: dbError } = await supabase
        .from('pdf_documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          extracted_text: extractedText
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      console.log('Document processed and saved successfully');
      alert('PDF uploaded successfully!');
      setText(''); // Clear the text display
      e.target.value = ''; // Reset the file input
      
    } catch (error) {
      console.error('Error:', error);
      alert(`Error processing PDF: ${error.message}`);
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