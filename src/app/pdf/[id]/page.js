'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

const PATTERN_CATEGORIES = {
  SWEATER: {
    name: 'Sweater/Top',
    keywords: ['genser', 'sweater', 'topp', 'jakke', 'bluse', 'cardigan'],
    measurements: [
      {
        name: 'overvidde',
        patterns: [
          /(?:blusens |genserens |genseens )?overvidde\s*:\s*([^:]*?)(?=\s*(?:lengde|strikkefasthet|\d+\s*cm|\n|$))/i,
          /omkrets\s*(?:cm)?\s*:\s*([^:]*?)(?=\s*(?:lengde|strikkefasthet|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      },
      {
        name: 'lengde',
        patterns: [
          /(?:hel )?lengde\s*(?:cm)?:?\s*([^:]*?)(?=\s*(?:strikkefasthet|pinne|inkl|målt|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      }
    ]
  },
  SOCKS: {
    name: 'Socks/Accessories',
    keywords: ['sokk', 'vott', 'vante', 'lue', 'skjerf', 'sjal'],
    measurements: [
      {
        name: 'fotlengde',
        patterns: [
          /fotlengde\s*:\s*([^:]*?)(?=\s*(?:strikkefasthet|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      }
    ]
  },
  BLANKET: {
    name: 'Blanket/Home',
    keywords: ['pledd', 'teppe', 'pute'],
    measurements: [
      {
        name: 'bredde',
        patterns: [
          /bredde\s*:\s*([^:]*?)(?=\s*(?:lengde|strikkefasthet|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      },
      {
        name: 'lengde',
        patterns: [
          /lengde\s*:\s*([^:]*?)(?=\s*(?:strikkefasthet|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      }
    ]
  }
};

const detectCategory = (text) => {
  console.log("Detecting category from text:", text.substring(0, 100) + "..."); // Debug log
  
  for (const [category, config] of Object.entries(PATTERN_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        console.log("Found category:", category, "with keyword:", keyword); // Debug log
        return category;
      }
    }
  }
  console.log("No category detected"); // Debug log
  return null;
};

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

const extractSizesAndMeasurements = (text) => {
  const category = detectCategory(text);
  console.log("Category detected in extract function:", category); // Debug

  const measurements = {};
  const sizes = extractSizes(text);
  
  if (category) {
    const measurementPatterns = PATTERN_CATEGORIES[category].measurements;
    
    measurementPatterns.forEach(({ name, patterns, unit }) => {
      let found = false;
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && !found) {
          const measurementText = match[1].trim();
          const numbers = [];
          const numberPattern = /(\d+)(?:\s*\((\d+)\))?/g;
          let numberMatch;
          
          while ((numberMatch = numberPattern.exec(measurementText)) !== null) {
            if (numberMatch[1]) numbers.push(parseInt(numberMatch[1]));
            if (numberMatch[2]) numbers.push(parseInt(numberMatch[2]));
          }

          if (numbers.length === sizes.length) {
            sizes.forEach((size, index) => {
              if (!measurements[size]) {
                measurements[size] = {};
              }
              measurements[size][name] = {
                value: numbers[index],
                unit: unit
              };
            });
            found = true;
          }
        }
      }
    });
  }

  return {
    category: category,
    sizes: sizes,
    measurements: measurements,
    categoryName: category ? PATTERN_CATEGORIES[category].name : null
  };
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

const highlightSizePosition = (text, selectedSize, sizes) => {
  if (!selectedSize || !sizes.includes(selectedSize)) return text;

  const sizeIndex = sizes.indexOf(selectedSize);
  let highlightedText = text;

  // Patterns for different number sequences
  const patterns = [
    // Original pattern for inline sequences with parentheses
    /(?:(?:\d+\.?(?:[,-]\d+)?|–|-)\s*(?:\([^)]+\)\s*)*)+/g,
    
    // Pattern for sequences of measurements with units (including those starting with period)
    /(?:\.|^)\s*(?:\d+\s*(?:cm|g|m)\s*){2,}/g,
    
    // Pattern for sequences after dots
    /\.{3,}\s*(?:\d+\s*(?:cm|g|m)?\s*){2,}/g,
    
    // Pattern for size-like formatted rows (with multiple spaces between items)
    /(?:^|\n)\s*(?:[\w\s]+:)?\s*(?:\d+\s*(?:cm|g|m)?\s+){2,}/g
  ];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (!matches) return;

    matches.forEach(sequence => {
      const numbers = [];
      let sequenceCopy = sequence;
      
      // Match numbers with their units
      const numberPattern = /(\d+\.?(?:[,-]\d+)?|–|-)\s*(cm|g|m)?/g;
      let match;
      
      // Collect all numbers in this sequence
      while ((match = numberPattern.exec(sequenceCopy)) !== null) {
        const number = match[1];
        const unit = match[2] || '';
        if (number) {
          numbers.push({
            number,
            unit,
            position: match.index,
            length: match[0].length,
            isInParentheses: false
          });
        }
      }

      // Only process if we have enough numbers to be a valid pattern
      if (numbers.length >= sizes.length) {
        const groupSize = Math.floor(numbers.length / sizes.length) * sizes.length;
        
        // Find the target number for the selected size
        const targetGroupIndex = Math.floor(sizeIndex * (numbers.length / sizes.length));
        const targetNumbers = numbers.slice(targetGroupIndex, targetGroupIndex + (groupSize / sizes.length));
        
        // Create a replacement with only the target numbers
        let newSequence = '';
        if (targetNumbers.length > 0) {
          const numberStr = targetNumbers.map(n => 
            `<span class="bg-yellow-200 px-1 rounded">${n.number}${n.unit ? ' ' + n.unit : ''}</span>`
          ).join(' ');
          newSequence = numberStr;
        }

        highlightedText = highlightedText.replace(sequenceCopy, newSequence);
      }
    });
  });

  return highlightedText;
};

export default function PdfPage() {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sizes, setSizes] = useState([]);
  const [measurements, setMeasurements] = useState({});
  const [selectedSize, setSelectedSize] = useState(null);
  const params = useParams();
  const router = useRouter();

  const handleDelete = async () => {
    try {
      if (!document) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error: dbError } = await supabase
        .from('pdf_documents')
        .delete()
        .match({
          id: document.id,
          user_id: user.id
        });

      if (dbError) throw dbError;

      if (document.file_path) {
        const pdfPath = document.file_path.endsWith('.pdf') 
          ? document.file_path 
          : `${document.file_path}.pdf`;
        
        const { error: pdfError } = await supabase.storage
          .from('pdfs')
          .remove([pdfPath]);
        
        if (pdfError) {
          console.error('Error deleting PDF file:', pdfError);
        }
      }

      if (document.thumbnail_path) {
        const { error: thumbError } = await supabase.storage
          .from('pdfs')
          .remove([document.thumbnail_path]);
        
        if (thumbError) {
          console.error('Error deleting thumbnail:', thumbError);
        }
      }

      router.push('/');

    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document: ' + error.message);
    }
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
        
        // Extract sizes and measurements from the text
        if (data.extracted_text) {
          console.log('Extracting sizes and measurements from:', data.extracted_text); // Debug log
          const { category, sizes, measurements, categoryName } = extractSizesAndMeasurements(data.extracted_text);
          console.log('Setting sizes to:', sizes); // Debug log
          console.log('Setting measurements to:', measurements); // Debug log
          setSizes(sizes);
          setMeasurements(measurements);
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <main className="max-w-4xl mx-auto">
        {/* Title and Category Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--mainheader)] mb-2">
            {document.display_title || document.file_name.replace(/\.pdf$/i, '')}
          </h1>
          {document.category_name && (
            <span className="inline-block px-3 py-1 rounded-md bg-purple-100 text-purple-800 text-sm font-medium">
              {document.category_name}
            </span>
          )}
        </div>
        
        {/* Size buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`px-4 py-2 rounded-full ${
                selectedSize === size 
                ? 'bg-blue-600 text-white' 
                : 'bg-blue-100 hover:bg-blue-200'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <p className="text-sm text-gray-500 mb-4">
            Uploaded on {new Date(document.created_at).toLocaleDateString()}
          </p>
          <div className="prose max-w-none">
            {document.extracted_text.split('\n\n').map((section, index) => (
              <div key={index} className="mb-4">
                <p 
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightSizePosition(section, selectedSize, sizes) 
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Delete button at bottom */}
        <div className="mt-8 pb-8 flex justify-end">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this pattern?')) {
                handleDelete();
              }
            }}
            className="px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Slett strikkeoppskrift
          </button>
        </div>
      </main>
    </div>
  );
}

// Helper function to format measurement name
const formatMeasurementName = (name) => {
  const names = {
    'overvidde': 'Overvidde/Omkrets',
    'lengde': 'Hel lengde',
    'fotlengde': 'Fotlengde',
    'bredde': 'Bredde'
  };
  return names[name] || name;
}; 