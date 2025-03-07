'use client';

import { useState, useRef, useEffect } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

export default function ImageCropper({ imageData, onCropComplete, onCancel }) {
  const [crop, setCrop] = useState({
    unit: '%',
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    aspect: 1
  });
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);

  useEffect(() => {
    if (!completedCrop || !imgRef.current || !previewCanvasRef.current) return;

    const image = imgRef.current;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = 150;
    canvas.height = 150;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create blob clip path
    ctx.beginPath();
    // Scale the blob path to fit our 150x150 canvas
    ctx.scale(0.75, 0.75); // 150/200 = 0.75 to scale from 200x200 to 150x150
    ctx.translate(100, 100);
    ctx.path = new Path2D("M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z");
    ctx.clip(ctx.path);

    // Reset transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      150,
      150
    );
  }, [completedCrop]);

  const getCroppedImg = async () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    
    const ctx = canvas.getContext('2d');

    // Create blob clip path
    ctx.beginPath();
    ctx.scale(completedCrop.width/200, completedCrop.height/200);
    ctx.translate(100, 100);
    ctx.path = new Path2D("M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z");
    ctx.clip(ctx.path);

    // Reset transformation
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Fill with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-2xl mx-auto overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="bg-[var(--mainheader)] px-6 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-white">Velg miniatyrbilde</h2>
          <button 
            onClick={onCancel}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-4 flex-grow overflow-hidden">
          <div className="h-full flex flex-col md:flex-row gap-4">
            <div className="flex-grow overflow-hidden bg-gray-50 rounded-lg relative">
              <div className="relative">
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                  className="max-h-full [&_.ReactCrop__crop-selection]:!rounded-none [&_.ReactCrop__crop-selection]:!overflow-visible"
                >
                  <img
                    ref={imgRef}
                    src={imageData}
                    alt="Pattern preview"
                    className="max-h-[calc(90vh-12rem)] w-auto mx-auto"
                    style={{ objectFit: 'contain' }}
                  />
                  {completedCrop && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        left: `${completedCrop.x}%`,
                        top: `${completedCrop.y}%`,
                        width: `${completedCrop.width}%`,
                        height: `${completedCrop.height}%`,
                        zIndex: 10
                      }}
                    >
                      <svg 
                        viewBox="0 0 200 200" 
                        className="w-full h-full"
                      >
                        <path
                          d="M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z"
                          transform="translate(100 100)"
                          fill="none"
                          stroke="white"
                          strokeWidth="4"
                          style={{
                            filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
                          }}
                        />
                      </svg>
                    </div>
                  )}
                </ReactCrop>
              </div>
            </div>
            
            {/* Preview Section */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <p className="text-sm text-gray-600">Forhåndsvisning</p>
              <div className="relative w-[150px] h-[150px]">
                <svg viewBox="0 0 200 200" className="w-full h-full absolute top-0 left-0">
                  <path
                    d="M45.3,-59.6C61.1,-50.9,77.8,-40.8,82.7,-26.7C87.7,-12.5,80.8,5.8,72.7,21.5C64.7,37.2,55.5,50.5,43.2,60.6C30.9,70.6,15.4,77.5,-1.4,79.5C-18.3,81.4,-36.5,78.4,-49.4,68.5C-62.3,58.6,-69.9,41.9,-74.7,24.8C-79.5,7.7,-81.5,-9.7,-76.8,-25.2C-72.1,-40.7,-60.7,-54.2,-46.7,-63.5C-32.8,-72.8,-16.4,-77.8,-0.8,-76.7C14.8,-75.6,29.5,-68.3,45.3,-59.6Z"
                    transform="translate(100 100)"
                    fill="var(--background)"
                    className="drop-shadow-md"
                  />
                </svg>
                <canvas
                  ref={previewCanvasRef}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={async () => {
              const croppedBlob = await getCroppedImg();
              if (croppedBlob) {
                onCropComplete(croppedBlob);
              }
            }}
            className="px-6 py-2 bg-[var(--mainheader)] text-white rounded-md hover:opacity-90 transition-colors"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
} 