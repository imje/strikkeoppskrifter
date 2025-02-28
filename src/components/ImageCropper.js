'use client';

import { useState, useRef } from 'react';
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

  const getCroppedImg = async () => {
    if (!completedCrop || !imgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    
    const ctx = canvas.getContext('2d');
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
          <div className="h-full flex flex-col">
            <div className="flex-grow overflow-hidden bg-gray-50 rounded-lg">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={1}
                className="max-h-full"
              >
                <img
                  ref={imgRef}
                  src={imageData}
                  alt="Pattern preview"
                  className="max-h-[calc(90vh-12rem)] w-auto mx-auto"
                  style={{ objectFit: 'contain' }}
                />
              </ReactCrop>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Velg et kvadratisk område som skal brukes som miniatyrbilde for mønsteret ditt.
            </p>
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