import React, { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

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

  if (previewUrl) return null;

  return (
    <div className="w-full">
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
    </div>
  );
}
