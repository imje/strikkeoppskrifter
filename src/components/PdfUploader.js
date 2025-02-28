'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { extractSizesAndMeasurements } from '@/lib/patternUtils';

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

      const sanitizedFileName = cleanFileName(file.name);
      console.log('Initial sanitized filename:', sanitizedFileName); // Debug log

      // Create optimistic document data
      const timestamp = Date.now();
      const optimisticDoc = {
        id: `temp-${sanitizedFileName}`,
        file_name: sanitizedFileName,
        display_title: sanitizedFileName,
        created_at: new Date().toISOString(),
      };

      console.log('Optimistic doc:', optimisticDoc); // Debug log

      // Immediately call onUploadSuccess with optimistic data
      if (onUploadSuccess) {
        onUploadSuccess(optimisticDoc);
      }

      // Continue with actual upload process
      console.log('Starting upload process...');

      const pdfjsLib = await initPdfLib();
      if (!pdfjsLib) {
        throw new Error('PDF.js failed to initialize');
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
      
      // Extract title using filename as reference
      const pdfTitle = await extractPdfTitle(pdf, file.name);
      const displayTitle = pdfTitle || sanitizedFileName;
      console.log('Final display title:', displayTitle); // Debug log

      console.log('Generating thumbnail...');
      const thumbnailBlob = await generateThumbnail(pdf);
      console.log('Thumbnail size:', thumbnailBlob.size, 'bytes');

      // Define pattern section headers
      const patternSectionHeaders = [
        'HALSKANT',
        'BRODERING',
        'ERMER',
        'BOL',
        'BÆRESTYKKE',
        'FORSTYKKE',
        'BAKSTYKKE',
        'HØYRE SKULDER',
        'VENSTRE SKULDER',
      ];

      const isPatternHeader = (str) => {
        const normalizedStr = str.trim().toUpperCase();
        return patternSectionHeaders.some(header => 
          normalizedStr === header ||
          normalizedStr.startsWith(header + ':')
        );
      };

      console.log('Extracting text...');
      let extractedText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });
        const pageHeight = viewport.height;
        
        let lastY, text = '';
        let currentLine = '';  // Add this to track the current line
        const items = textContent.items;
        
        // Add this function inside handleFileUpload
        const shouldKeepTogether = (line, nextStr) => {
          const prefixes = [
            'Veiledende',
            'Blusens',
            'Genseens',
            'Genserens'
          ];
          return prefixes.some(prefix => 
            line.trim() === prefix || 
            (line.includes(prefix) && !line.includes(prefix + ' '))
          );
        };

        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          
          // Debug log for filtered items
          const originalStr = item.str;
          
          // Filter out footer and copyright content regardless of position
          const isFooterContent = 
            // Social media and web patterns
            (item.str.includes('@') && item.str.includes('www.')) ||           // Combined social media and web
            (item.str.match(/^@[\w.]+$/)) ||                                   // Standalone social media handle
            (item.str.match(/^www\.[\w.]+$/i)) ||                             // Standalone website URL
            (item.str.includes('@') && item.str.includes('//')) ||            // Author with social media
            
            // Hashtags
            (item.str.trim().startsWith('#')) ||                              // Single hashtag
            (item.str.match(/#\w+\s+#\w+/)) ||                               // Multiple hashtags
            item.str.split(' ').every(word => word.startsWith('#')) ||       // Line containing only hashtags
            
            // Copyright and sharing notices
            item.str.includes('©') ||                                          // Copyright symbol
            item.str.toLowerCase().includes('copyright') ||                    // Copyright word
            (item.str.toLowerCase().includes('#') && 
             item.str.toLowerCase().includes('instagram')) ||                  // Instagram hashtag instructions
            (item.str.toLowerCase().includes('dele') && 
             item.str.toLowerCase().includes('instagram')) ||                  // Sharing on Instagram
            
            // Photo credits
            (item.str.toLowerCase().startsWith('foto:')) ||                   // Photo credit
            
            // Page numbers
            (item.str.match(/^side\s*\d+$/i) && item.str.length < 10) ||    // Exact "Side X"
            (item.str.match(/^page\s*\d+$/i) && item.str.length < 10) ||    // Exact "Page X"
            
            // Copyright notices - check for partial matches
            item.str.toLowerCase().includes('oppskriften er kun til privat') ||
            item.str.toLowerCase().includes('skal ikke kopieres') ||
            item.str.toLowerCase().includes('skal ikke deles') ||
            item.str.toLowerCase().includes('må ikke deles') ||
            item.str.toLowerCase().includes('kun til privat bruk') ||
            item.str.toLowerCase().includes('systematisk salg') ||            // Commercial use notice
            
            // Social sharing instructions
            (item.str.toLowerCase().includes('#') && 
             item.str.toLowerCase().includes('del')) ||                      // Sharing instructions with hashtags
            
            // Author/Designer credits
            (item.str.includes('//') && item.str.includes('@')) ||          // Author with social handle
            (item.str.match(/^[\w\s]+©/));                                  // Author name with copyright

          if (isFooterContent) {
            console.log('Filtered out:', originalStr, 'due to footer pattern match');
            continue;
          }
          
          const currentY = item.transform[5];
          const verticalGap = lastY ? Math.abs(lastY - currentY) : 0;
          
          // Modified line continuation check
          const shouldContinueLine = 
            currentLine && (
              shouldKeepTogether(currentLine, item.str) ||          // Check for phrases to keep together
              currentLine.endsWith('=') ||                          // Line ends with equals
              currentLine.match(/\d+\s*$/) ||                      // Line ends with number
              item.str.match(/^\s*\d+/) ||                         // Next line starts with number
              verticalGap < 5 ||                                   // Very small vertical gap
              (currentLine.length + item.str.length < 60)          // Combined length is reasonable
            );

          if (shouldContinueLine) {
            // Add a space if needed between parts
            if (!currentLine.endsWith(' ') && !item.str.startsWith(' ')) {
              currentLine += ' ';
            }
            currentLine += item.str
              .replace(/\.{3,}/g, '')     // Remove dot sequences
              .replace(/\s{2,}/g, ' ');   // Normalize spaces
          } else {
            // Process and add the completed line if we have one
            if (currentLine) {
              currentLine = currentLine.trim();
              
              const headerWord = isKnittingHeader(currentLine);
              if (headerWord) {
                // Remove any leading numbers and the header word from the rest of the line
                const cleanedLine = currentLine.replace(/^\d+\s+/, '');
                const restOfLine = cleanedLine.substring(headerWord.length).trim();
                text += '\n\n<h3>' + headerWord + '</h3>\n' + formatTextWithBold(restOfLine) + '\n';
              } else if (currentLine.match(/^[A-ZÆØÅ\s]{5,}:?$/)) {
                text += '\n\n' + formatTextWithBold(currentLine) + '\n\n';
              } else if (currentLine.match(/^(?:STØRRELSE|STRIKKEFASTHET|PINNER|GARNFORSLAG|TILBEHØR|MÅL|FORKORTELSER):/i)) {
                text += '\n\n' + formatTextWithBold(currentLine) + '\n';
              } else {
                text += formatTextWithBold(currentLine) + '\n';
              }
            }
            
            // Start new line
            currentLine = item.str;
          }
          
          lastY = currentY;
        }
        
        // Add final line if exists
        if (currentLine) {
          currentLine = currentLine.trim();
          text += currentLine + '\n';
        }
        
        extractedText += text + '\n\n';
      }

      // Clean up excessive line breaks and whitespace
      extractedText = extractedText
        .replace(/\n{4,}/g, '\n\n\n')  // Allow up to 3 consecutive line breaks
        .replace(/\*\* \n/g, '**\n')    // Clean up bold formatting
        .replace(/[ \t]+$/gm, '')       // Remove trailing spaces
        .trim();

      // Get category information
      const { category, categoryName } = extractSizesAndMeasurements(extractedText);
      console.log('Category info:', { category, categoryName }); // Debug log

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
          extracted_text: extractedText,
          category: category || null,
          category_name: categoryName || null
        })
        .select()
        .single();

      console.log('Database response:', dbData); // Debug log

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Database operation failed: ${dbError.message}`);
      }

      console.log('Upload completed successfully');

      if (dbData) {
        const finalDoc = {
          ...dbData,
          display_title: displayTitle,
          file_name: sanitizedFileName,
          thumbnailUrl: null
        };
        console.log('Final document being sent:', finalDoc); // Debug log
        onUploadSuccess(finalDoc);
      }
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