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

export default function PdfUploader({ onUploadSuccess }) {
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

  const generateThumbnail = async (pdf) => {
    try {
      const firstPage = await pdf.getPage(1);
      const scale = 2;
      const viewport = firstPage.getViewport({ scale });
      
      // Create main canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill with white background
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Render the page
      await firstPage.render({
        canvasContext: context,
        viewport: viewport,
        background: 'white',
        intent: 'display',
      }).promise;

      // Crop to the area where the image likely is
      // Adjust these values based on your PDF layout
      const cropX = canvas.width * 0.1;  // 10% from left
      const cropY = canvas.height * 0.15; // 15% from top
      const cropWidth = canvas.width * 0.8;  // 80% of width
      const cropHeight = canvas.height * 0.6; // 60% of height

      // Create a new canvas for the cropped image
      const croppedCanvas = document.createElement('canvas');
      const croppedContext = croppedCanvas.getContext('2d');
      croppedCanvas.width = cropWidth;
      croppedCanvas.height = cropHeight;

      // Copy the cropped portion
      croppedContext.drawImage(
        canvas,
        cropX, cropY, cropWidth, cropHeight,  // Source coordinates
        0, 0, cropWidth, cropHeight           // Destination coordinates
      );

      // Convert to blob
      const blob = await new Promise((resolve) => {
        croppedCanvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      if (!blob) {
        throw new Error('Failed to generate thumbnail');
      }

      console.log('Thumbnail generated successfully:', blob.size, 'bytes');
      return blob;

    } catch (error) {
      console.error('Error in generateThumbnail:', error);
      throw error;
    }
  };

  const extractPdfTitle = async (pdf) => {
    try {
      // Try to get title from metadata first
      const metadata = await pdf.getMetadata();
      if (metadata?.info?.Title) {
        const title = metadata.info.Title.trim();
        if (title.length > 0 && title.length < 100) return title;
      }

      // If no metadata title, try to get from first page content
      const firstPage = await pdf.getPage(1);
      const textContent = await firstPage.getTextContent();
      
      // Get first few lines of text, filtering out empty lines and very short lines
      const firstLines = textContent.items
        .map(item => item.str.trim())
        .filter(str => str.length > 2)  // Filter out very short strings
        .filter(str => /[a-zA-Z]/.test(str))  // Must contain at least one letter
        .slice(0, 10); // Get first 10 non-empty lines
      
      console.log('First lines found:', firstLines); // Debugging help
      
      // Look for a line that's likely to be a title
      const titleLine = firstLines.find(line => {
        // Title characteristics
        const isReasonableLength = line.length >= 3 && line.length < 50;
        const doesntEndWithPunctuation = !line.match(/[.,:;]$/);
        const hasLetters = /[a-zA-Z]/.test(line);
        const isNotAllCaps = line !== line.toUpperCase();
        const isNotEmail = !line.includes('@');
        const isNotUrl = !line.match(/^https?:\/\//);
        const hasNoLineNumbers = !line.match(/^\d+\./);
        
        return isReasonableLength && 
               doesntEndWithPunctuation && 
               hasLetters && 
               isNotAllCaps &&
               isNotEmail &&
               isNotUrl &&
               hasNoLineNumbers;
      });

      // If we found a good title, use it
      if (titleLine) {
        return titleLine;
      }

      // If we couldn't find a good title, try the first substantial line
      const fallbackTitle = firstLines.find(line => 
        line.length >= 3 && 
        line.length < 50 && 
        /[a-zA-Z]/.test(line)
      );

      return fallbackTitle || null;
    } catch (error) {
      console.error('Error extracting PDF title:', error);
      return null;
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

      // Create optimistic document data
      const timestamp = Date.now();
      const sanitizedFileName = file.name
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/\.pdf$/i, ''); // Remove .pdf extension
      const optimisticDoc = {
        id: `temp-${timestamp}`,
        file_name: sanitizedFileName,
        created_at: new Date().toISOString(),
      };

      // Immediately call onUploadSuccess with optimistic data
      if (onUploadSuccess) {
        onUploadSuccess(optimisticDoc);
      }

      // Continue with actual upload process in background
      console.log('Starting upload process...');

      // Generate thumbnail
      const pdfjsLib = await initPdfLib();
      if (!pdfjsLib) {
        throw new Error('PDF.js failed to initialize');
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      // Extract title from PDF
      const pdfTitle = await extractPdfTitle(pdf);
      console.log('Extracted PDF title:', pdfTitle);
      
      // Use extracted title or fall back to filename without extension
      const displayTitle = pdfTitle || file.name.replace(/\.pdf$/i, '');

      console.log('Generating thumbnail...');
      const thumbnailBlob = await generateThumbnail(pdf);
      console.log('Thumbnail size:', thumbnailBlob.size, 'bytes');

      // Extract text
      console.log('Extracting text...');
      let extractedText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        extractedText += pageText + '\n';
      }

      // Create file paths
      const fileName = `${timestamp}-${sanitizedFileName}`;
      const filePath = `${user.id}/${fileName}`;
      const thumbnailPath = `${user.id}/thumbnails/${timestamp}-thumbnail.jpg`;

      console.log('Uploading PDF...');
      // Upload PDF
      const { data: pdfData, error: pdfError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (pdfError) {
        console.error('PDF upload error:', pdfError);
        throw new Error(`PDF upload failed: ${pdfError.message}`);
      }

      console.log('Uploading thumbnail...');
      // Upload thumbnail
      const { data: thumbData, error: thumbError } = await supabase.storage
        .from('pdfs')
        .upload(thumbnailPath, thumbnailBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (thumbError) {
        console.error('Thumbnail upload error:', thumbError);
        throw new Error(`Thumbnail upload failed: ${thumbError.message}`);
      }

      console.log('Saving to database...');
      // Save to database
      const { data: dbData, error: dbError } = await supabase
        .from('pdf_documents')
        .insert({
          user_id: user.id,
          file_name: sanitizedFileName,
          display_title: displayTitle,
          file_path: filePath,
          thumbnail_path: thumbnailPath,
          extracted_text: extractedText
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Database operation failed: ${dbError.message}`);
      }

      console.log('Upload completed successfully');
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
      alert('An error occurred while uploading the file. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="relative inline-block">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
          disabled={loading}
        />
        <div 
          className="w-12 h-12 rounded-full bg-[var(--mainheader)] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 4v16m8-8H4" 
              />
            </svg>
          )}
        </div>
      </label>
    </div>
  );
}