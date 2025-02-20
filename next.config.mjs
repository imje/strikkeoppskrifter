/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Disable node-specific modules
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;

    // Handle PDF.js worker
    config.resolve.alias['pdfjs-dist/build/pdf.worker.min'] = 'pdfjs-dist/build/pdf.worker.min.js';
    
    return config;
  },
};

export default nextConfig;
