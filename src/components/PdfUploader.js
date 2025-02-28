'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { extractSizesAndMeasurements } from '@/lib/patternUtils';
import ImageCropper from './ImageCropper';

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
  const [showCropper, setShowCropper] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [pendingUpload, setPendingUpload] = useState(null);

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

  const cleanFileName = (fileName) => {
    return fileName
      .replace(/\.pdf$/i, '') // Remove .pdf extension
      .replace(/%20/g, ' ') // Replace %20 with space
      .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
      .replace(/(\d+)([A-Za-z])/g, '$1 $2') // Add space between number and letter
      .replace(/([A-Za-z])(\d+)/g, '$1 $2') // Add space between letter and number
      .replace(/no(\d+)/i, 'No. $1') // Convert "no4" to "No. 4"
      .replace(/([0-9]) /g, '$1. ') // Add period after standalone numbers
      .replace(/[^a-zA-ZæøåÆØÅ0-9\s.]/g, '') // Only allow letters, numbers, periods, and spaces
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim() // Remove leading/trailing spaces
      .split(' ') // Split into words
      .map(word => {
        // Special case for "No." to ensure correct capitalization
        if (word.toLowerCase() === 'no.') return 'No.';
        // Capitalize first letter of other words
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' '); // Join back together
  };

  const toTitleCase = (str) => {
    // First, check if this is a spaced-out string with multiple capital letters
    if (str.split(' ').filter(char => char.match(/^[A-ZÆØÅ]$/)).length > 2) {
      // Join all letters and convert to title case
      const joined = str.replace(/\s+/g, '');
      return joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
    }

    // Normal title case handling for other strings
    return str
      .toLowerCase()
      .split(' ')
      .map(word => {
        // Special cases
        if (word.toLowerCase() === 'no.') return 'No.';
        if (word.toLowerCase() === 'i') return 'i';  // Keep Norwegian 'i' lowercase
        // Capitalize first letter of other words
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  };

  const extractPdfTitle = async (pdf, originalFileName) => {
    try {
      // Check first 3 pages for content
      for (let pageNum = 1; pageNum <= Math.min(3, pdf.numPages); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Get all text from page
        const lines = textContent.items
          .map(item => item.str.trim())
          .filter(line => {
            // Basic filters
            if (line.length < 3) return false;  // too short
            if (line.length > 50) return false; // too long
            if (!line.match(/[a-zA-ZæøåÆØÅ]/)) return false; // must have letters
            if (line.match(/^[0-9]/)) return false; // skip lines starting with numbers
            if (line.match(/^side/i)) return false; // skip lines starting with 'side'
            if (line.match(/^page/i)) return false; // skip lines starting with 'page'
            if (line.includes('@')) return false; // skip email addresses
            if (line.includes('http')) return false; // skip URLs
            if (line.includes(':')) return false; // skip lines with colons
            if (line.match(/størrelser/i)) return false; // skip size information
            if (line.match(/^(str|størrelse)/i)) return false; // skip size headers
            if (line.match(/^materialer/i)) return false; // skip materials header
            if (line.match(/^oppskrift/i)) return false; // skip "oppskrift" header
            if (line.match(/^copyright/i)) return false; // skip copyright info
            if (line.match(/^[XSMLxsml0-9()]+$/)) return false; // skip size listings
            
            return true;
          })
          .map(line => {
            // Clean up the line
            return line
              .replace(/^OM\s+/i, '') // Remove "OM" from the start
              .trim();
          });

        // If we found any valid lines on this page
        if (lines.length > 0) {
          const potentialTitle = lines[0];
          if (!potentialTitle.match(/^[XSMLxsml0-9()\s]+$/) && 
              potentialTitle.length >= 3 && 
              potentialTitle.match(/[a-zA-ZæøåÆØÅ]/)) {
            return toTitleCase(potentialTitle);
          }
        }
      }

      // If no good title found in PDF, use cleaned filename
      const cleanedTitle = cleanFileName(originalFileName);
      return toTitleCase(cleanedTitle);

    } catch (error) {
      console.error('Error extracting PDF title:', error);
      return toTitleCase(cleanFileName(originalFileName));
    }
  };

  // Update the knitting header patterns
  const isKnittingHeader = (line) => {
    // Define exact header words with their proper capitalization
    const headerPatterns = {
      'Bol': /^(?:\d+\s+)?bol(?:\s|$)/i,
      'Erme': /^(?:\d+\s+)?erme(?:\s|$)/i,
      'Ermer': /^(?:\d+\s+)?ermer(?:\s|$)/i,
      'Forstykke': /^(?:\d+\s+)?forstykke(?:\s|$)/i,
      'Bakstykke': /^(?:\d+\s+)?bakstykke(?:\s|$)/i,
      'Bærestykke': /^(?:\d+\s+)?bærestykke(?:\s|$)/i,
      'Halskant': /^(?:\d+\s+)?halskant(?:\s|$)/i,
      'Montering': /^(?:\d+\s+)?montering(?:\s|$)/i,
      'Høyre erme': /^(?:\d+\s+)?høyre\s+erme(?:\s|$)/i,
      'Venstre erme': /^(?:\d+\s+)?venstre\s+erme(?:\s|$)/i,
      'Krage': /^(?:\d+\s+)?krage(?:\s|$)/i
    };
    
    // Clean the line
    const cleanLine = line.trim();
    
    // Return the matched header with proper capitalization
    for (const [header, pattern] of Object.entries(headerPatterns)) {
      if (cleanLine.match(pattern)) {
        return header;  // Return the properly capitalized header
      }
    }
    return null;
  };

  const formatTextWithBold = (text) => {
    // Define the patterns in a more structured way
    const multiWordTerms = [
      'Blusens overvidde',
      'Veiledende pinner',
      'Genseens overvidde',
      'Genserens overvidde',
      'Plaggets mål'
    ];

    const singleWordTerms = [
      'Materialer?',
      'Strikkefasthet(?:en)?',
      'Pinner|Pinneforslag',
      'Overvidde',
      'Garnforslag|Garn|Garnalternativ|Garnkvalitet',
      'Størrelser?|Str\\.',
      'Tilbehør',
      'Mål',
      'Lengde',
      'Forkortelser'
    ];

    let formattedText = text;

    // First, fix any broken multi-word terms
    multiWordTerms.forEach(term => {
      const brokenPattern = new RegExp(`${term.split(' ').join('\\s*\\n*\\s*')}:`, 'g');
      formattedText = formattedText.replace(brokenPattern, `\n${term}:`);
    });

    // Then handle single word terms
    singleWordTerms.forEach(term => {
      const pattern = new RegExp(`\\b(${term}):`, 'g');
      formattedText = formattedText.replace(pattern, `\n$1:`);
    });

    // Finally, make all terms bold
    const allTerms = [
      ...multiWordTerms.map(term => term.replace(/\s+/g, '\\s+')),
      ...singleWordTerms
    ].join('|');
    
    formattedText = formattedText.replace(
      new RegExp(`(${allTerms}):`, 'g'),
      '<span class="font-bold">$1:</span>'
    );

    return formattedText;
  };

  const processPage = async (page) => {
    const textContent = await page.getTextContent();
    let text = await page.getTextContent();
    
    // Convert text content to string and fix line breaks
    let rawText = textContent.items.map(item => item.str).join(' ');
    
    // Fix the broken phrases first
    rawText = rawText
      .replace(/Blusens\s*\n*\s*overvidde/g, 'Blusens overvidde')
      .replace(/Veiledende\s*\n*\s*pinner/g, 'Veiledende pinner')
      .replace(/Genseens\s*\n*\s*overvidde/g, 'Genseens overvidde')
      .replace(/Genserens\s*\n*\s*overvidde/g, 'Genserens overvidde');

    // Split into lines and clean up
    let lines = rawText.split(/\n+/);
    lines = lines.map(line => line.trim()).filter(line => line);

    // Join the lines back with proper line breaks
    text = lines.join('\n');

    return text;
  };

  const generateInitialImage = async (pdf) => {
    try {
      const firstPage = await pdf.getPage(1);
      const scale = 2;
      const viewport = firstPage.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await firstPage.render({
        canvasContext: context,
        viewport: viewport,
        background: 'white',
        intent: 'display',
      }).promise;

      return canvas.toDataURL('image/jpeg');
    } catch (error) {
      console.error('Error generating initial image:', error);
      throw error;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.includes('pdf')) return;

    try {
      setLoading(true);
      const pdfjsLib = await initPdfLib();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      
      // Generate initial image for cropping
      const imageData = await generateInitialImage(pdf);
      
      // Store file and pdf data for later use
      setPendingUpload({ file, pdf });
      
      // Show cropper with the generated image
      setImageData(imageData);
      setShowCropper(true);
    } catch (error) {
      console.error('Error preparing file:', error);
      alert('Error preparing file for upload');
    } finally {
      setLoading(false);
    }
  };

  const handleCropComplete = async (croppedBlob) => {
    if (!pendingUpload) return;
    
    try {
      setLoading(true);
      setShowCropper(false);
      
      const { file, pdf } = pendingUpload;
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('No user found');

      // Extract text and title from PDF
      const numPages = pdf.numPages;
      let fullText = '';
      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
      }

      // Extract display title
      const displayTitle = await extractPdfTitle(pdf, file.name);

      // Upload PDF file
      const timestamp = Date.now();
      const cleanedFileName = cleanFileName(file.name);
      const filePath = `${user.data.user.id}/${timestamp}-${cleanedFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Upload thumbnail
      const thumbnailPath = `${user.data.user.id}/thumbnails/${timestamp}-thumbnail.jpg`;
      const { error: thumbError } = await supabase.storage
        .from('pdfs')
        .upload(thumbnailPath, croppedBlob);

      if (thumbError) throw thumbError;

      // Save document info to database
      const { data: doc, error: dbError } = await supabase
        .from('pdf_documents')
        .insert([{
          user_id: user.data.user.id,
          file_name: cleanedFileName,
          display_title: displayTitle,
          file_path: filePath,
          thumbnail_path: thumbnailPath,
          extracted_text: fullText
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      if (onUploadSuccess) {
        onUploadSuccess(doc);
      }

    } catch (error) {
      console.error('Error in upload:', error);
      alert('Error uploading file');
    } finally {
      setLoading(false);
      setPendingUpload(null);
      setImageData(null);
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageData(null);
    setPendingUpload(null);
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
        <div className="w-12 h-12 rounded-full bg-[var(--mainheader)] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity">
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

      {showCropper && imageData && (
        <ImageCropper
          imageData={imageData}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}