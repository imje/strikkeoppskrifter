// Pattern Categories Configuration
const PATTERN_CATEGORIES = {
  SWEATER: {
    name: 'Sweater',
    keywords: [
      'sweater', // Will match 'earniesweater', 'summersweater', etc.
      'genser',  // Will match 'strikkegenser', 'ullgenser', etc.
      'jakke',   // Will match 'strikkejakke', 'sommerjakke', etc.
      'bluse',   // Will match 'cloudbluse', etc.
      'cardigan',
      'blouse'
    ],
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
    name: 'Accessories',
    keywords: ['sokker', 'votter', 'vanteer', 'lue', 'skjerf', 'sjal', 'socks', 'scarf', 'shawl'],
    measurements: [
      {
        name: 'fotlengde',
        patterns: [
          /fotlengde\s*:\s*([^:]*?)(?=\s*(?:strikkefasthet|\d+\s*cm|\n|$))/i
        ],
        unit: 'cm'
      }
    ]
  }
};

// Helper Functions
const standardizeSize = (size) => {
  if (!size) return null;
  size = size.toUpperCase();
  return size === '2XL' ? 'XXL' : size;
};

const isValidLetterSize = (size) => {
  const validSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];
  return validSizes.includes(size);
};

const detectCategory = (text) => {
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  for (const [category, config] of Object.entries(PATTERN_CATEGORIES)) {
    for (const keyword of config.keywords) {
      const lowerKeyword = keyword.toLowerCase();
      // Create base keywords from compound words
      const baseKeywords = ['sweater', 'genser', 'jakke', 'bluse'];
      
      if (
        baseKeywords.some(base => lowerText.includes(base)) || // Match any word containing base keywords
        lowerText.includes(lowerKeyword) // Keep original exact matches for other keywords
      ) {
        console.log("Found category:", category, "with match in text:", lowerText);
        return category;
      }
    }
  }
  return null;
};

const extractSizes = (text) => {
  if (!text) return [];

  const sizeHeaderPatterns = [
    /størrelser?\s*:?\s*([^:]*?)(?=\s*(?:blusens|genseens|genserens|strikkefasthet|omkrets|lengde|pinne|alt|plaggets|mål|\d+\s*cm|$))/i,
    /str\.?\s*:?\s*([^:]*?)(?=\s*(?:blusens|genseens|genserens|strikkefasthet|omkrets|lengde|pinne|alt|plaggets|mål|\d+\s*cm|$))/i
  ];

  let foundSizes = new Set();
  
  for (const pattern of sizeHeaderPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const sizePart = match[1].trim();
      const cleanSizePart = sizePart.replace(/\.+/g, ' ').replace(/\s+/g, ' ').trim();

      // Try to match alternating parenthesized sizes: (XS) S (M) L (XL) XXL
      const alternatingParenPattern = /\(([A-Z0-9]{1,4})\)|([A-Z0-9]{1,4})/g;
      let altParenMatches;
      let foundAlternatingParen = false;
      
      while ((altParenMatches = alternatingParenPattern.exec(cleanSizePart)) !== null) {
        const size = standardizeSize(altParenMatches[1] || altParenMatches[2]);
        if (isValidLetterSize(size)) {
          foundSizes.add(size);
          foundAlternatingParen = true;
        }
      }

      if (foundAlternatingParen) continue;

      // Add other size pattern matching here if needed
    }
  }

  return Array.from(foundSizes).sort((a, b) => {
    const letterOrder = {
      'XXS': 0, 'XS': 1, 'S': 2, 'M': 3, 'L': 4,
      'XL': 5, 'XXL': 6, '3XL': 7, '4XL': 8, '5XL': 9
    };
    return (letterOrder[a] ?? 999) - (letterOrder[b] ?? 999);
  });
};

export const extractSizesAndMeasurements = (text) => {
  if (!text) {
    return {
      category: null,
      categoryName: null,
      sizes: [],
      measurements: {}
    };
  }

  const category = detectCategory(text);
  const sizes = extractSizes(text);
  const measurements = {};

  if (category && PATTERN_CATEGORIES[category]) {
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
    category,
    categoryName: category ? PATTERN_CATEGORIES[category].name : null,
    sizes,
    measurements
  };
};

export { PATTERN_CATEGORIES }; 