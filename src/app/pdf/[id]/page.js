'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export default function PdfPage() {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState([]);
  const params = useParams();

  const extractSizes = (text) => {
    // Find size section
    const sizeHeaderPatterns = [
      /størrelser\s*:?\s*([^:]*?)(?=\s*(?:blusens|genseens|genserens|strikkefasthet|omkrets|lengde|pinne|alt|plaggets|mål|\d+\s*cm|$))/i,
      /str\.?\s*:?\s*([^:]*?)(?=\s*(?:blusens|genseens|genserens|strikkefasthet|omkrets|lengde|pinne|alt|plaggets|mål|\d+\s*cm|$))/i
    ];

    let foundSizes = new Set();
    let rangeSizes = new Set();
    
    for (const pattern of sizeHeaderPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const sizePart = match[1].trim();
        console.log('Found size section:', sizePart); // Debug log

        // Clean up the size part
        const cleanSizePart = sizePart
          .replace(/\.+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Try to match alternating range sizes first: XS-S (S-M)
        const alternatingRangePattern = /(?:([A-Z0-9]{1,3}-[A-Z0-9]{1,3})\s*(?:\(([A-Z0-9]{1,3}-[A-Z0-9]{1,3})\))?)/g;
        let altRangeMatches;
        let foundAlternatingRanges = false;
        
        while ((altRangeMatches = alternatingRangePattern.exec(cleanSizePart)) !== null) {
          if (altRangeMatches[1]) {
            const range = standardizeRange(altRangeMatches[1]);
            if (range) {
              foundSizes.add(range);
              foundAlternatingRanges = true;
            }
          }
          if (altRangeMatches[2]) {
            const range = standardizeRange(altRangeMatches[2]);
            if (range) {
              foundSizes.add(range);
              foundAlternatingRanges = true;
            }
          }
        }

        // If we found alternating ranges, skip other patterns
        if (foundAlternatingRanges) continue;

        // Try alternating paired numeric sizes: 35/36 (37/38)
        const alternatingPairedPattern = /(?:(\d{2}\/\d{2})\s*(?:\((\d{2}\/\d{2})\))?)/g;
        let altPairedMatches;
        let foundAlternatingPaired = false;
        
        while ((altPairedMatches = alternatingPairedPattern.exec(cleanSizePart)) !== null) {
          if (altPairedMatches[1]) {
            foundSizes.add(altPairedMatches[1]);
            foundAlternatingPaired = true;
          }
          if (altPairedMatches[2]) {
            foundSizes.add(altPairedMatches[2]);
            foundAlternatingPaired = true;
          }
        }

        // If we found alternating paired sizes, skip other patterns
        if (foundAlternatingPaired) continue;

        // Try alternating letter sizes: XXS (XS) S (M)
        const alternatingPattern = /(?:([A-Z0-9]{1,4})\s*(?:\(([A-Z0-9]{1,4})\))?)/g;
        let altMatches;
        let foundAlternating = false;
        
        while ((altMatches = alternatingPattern.exec(cleanSizePart)) !== null) {
          if (altMatches[1]) {
            const size = standardizeSize(altMatches[1]);
            if (isValidLetterSize(size)) {
              foundSizes.add(size);
              foundAlternating = true;
            }
          }
          if (altMatches[2]) {
            const size = standardizeSize(altMatches[2]);
            if (isValidLetterSize(size)) {
              foundSizes.add(size);
              foundAlternating = true;
            }
          }
        }

        // If we found any sizes, break the loop
        if (foundSizes.size > 0) break;
      }
    }

    // Sort the sizes
    const sizeArray = Array.from(foundSizes).sort((a, b) => {
      const letterOrder = {
        'XXS': 0, 'XS': 1, 'S': 2, 'M': 3, 'L': 4,
        'XL': 5, 'XXL': 6, '3XL': 7, '4XL': 8, '5XL': 9
      };

      // For hyphenated sizes, sort by first size
      const getFirstSize = (str) => str.split('-')[0];
      
      const sizeA = getFirstSize(a);
      const sizeB = getFirstSize(b);
      
      // If both are numeric sizes (like 35/36)
      if (a.includes('/') && b.includes('/')) {
        return parseInt(a) - parseInt(b);
      }
      
      const orderA = letterOrder[sizeA];
      const orderB = letterOrder[sizeB];
      
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }

      // Put letter sizes before numeric sizes
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;

      return 0;
    });

    return sizeArray;
  };

  // Helper function to standardize size notation
  const standardizeSize = (size) => {
    size = size.toUpperCase();
    return size === '2XL' ? 'XXL' : size;
  };

  // Helper function to standardize range notation
  const standardizeRange = (range) => {
    const [size1, size2] = range.split('-');
    if (!size1 || !size2) return null;
    
    const standardSize1 = standardizeSize(size1);
    const standardSize2 = standardizeSize(size2);
    
    if (isValidLetterSize(standardSize1) && isValidLetterSize(standardSize2)) {
      return `${standardSize1}-${standardSize2}`;
    }
    return null;
  };

  // Helper function to validate letter sizes
  const isValidLetterSize = (size) => {
    const validSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
    return validSizes.includes(size);
  };

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const { data, error } = await supabase
          .from('pdf_documents')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setDocument(data);
        
        // Extract sizes from the text
        if (data.extracted_text) {
          console.log('Extracting sizes from:', data.extracted_text); // Debug log
          const extractedSizes = extractSizes(data.extracted_text);
          console.log('Setting sizes to:', extractedSizes); // Debug log
          setSizes(extractedSizes);
        }
      } catch (error) {
        console.error('Error fetching document:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [params.id]);

  if (loading) return <div>Loading...</div>;
  if (!document) return <div>Document not found</div>;

  return (
    <div className="min-h-screen p-8">
      <main className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">{document.file_name}</h1>
        
        {sizes && sizes.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Størrelser:</h2>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-[var(--mainheader)] text-white rounded-full text-sm"
                >
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500 mb-4">
            Uploaded on {new Date(document.created_at).toLocaleDateString()}
          </p>
          <h2 className="text-xl font-bold mb-4">Extracted Text</h2>
          <div className="prose max-w-none">
            {document.extracted_text.split('\n\n').map((section, index) => (
              <div key={index} className="mb-4">
                <p className="whitespace-pre-wrap">{section}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
} 