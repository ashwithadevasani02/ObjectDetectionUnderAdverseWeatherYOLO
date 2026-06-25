import React, { useRef, useState } from 'react';
import { UploadCloud, X, FileImage } from 'lucide-react';

export default function UploadZone({ selectedFile, setSelectedFile, previewUrl, setPreviewUrl, onClear }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file format. Only JPG, JPEG, and PNG images are allowed.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleButtonClick();
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (onClear) onClear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      {!previewUrl ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={handleButtonClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label="Upload an image"
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 outline-none
            ${isDragActive 
              ? 'border-blue-500 bg-blue-50/30' 
              : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png"
            onChange={handleChange}
          />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <div className="p-3 mb-3 bg-slate-50 rounded-full text-slate-400 group-hover:bg-slate-100 transition-colors">
              <UploadCloud className="w-8 h-8 text-blue-500" />
            </div>
            <p className="mb-1 text-sm text-slate-700 font-medium">
              <span className="text-blue-600 hover:underline">Click to browse</span> or drag & drop image
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports JPG, JPEG, PNG
            </p>
          </div>
        </div>
      ) : (
        <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center p-2 group h-64">
          <img
            src={previewUrl}
            alt="Upload Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
          />
          <button
            onClick={handleRemove}
            type="button"
            className="absolute top-4 right-4 p-1.5 bg-white/90 hover:bg-white text-slate-600 hover:text-red-600 rounded-full shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-100"
            title="Remove image"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="absolute bottom-4 left-4 bg-black/60 text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <FileImage className="w-3.5 h-3.5" />
            <span className="truncate max-w-[150px]">
              {selectedFile ? selectedFile.name : 'Image Uploaded'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
