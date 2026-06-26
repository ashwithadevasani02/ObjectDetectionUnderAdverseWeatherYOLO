import React, { useState } from 'react';
import UploadZone from './components/UploadZone';
import DetectionList from './components/DetectionList';
import { Loader2, ShieldCheck, AlertCircle, ImageIcon, Eye, Play } from 'lucide-react';
const API_BASE = 'http://localhost:4000/api';
export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [annotatedImage, setAnnotatedImage] = useState(null);
  const [detections, setDetections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    // Auto-dismiss toast
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnnotatedImage(null);
    setDetections([]);
    setToast(null);
  };

  const handleDetect = async () => {
    if (!selectedFile) return;
    setIsLoading(true);
    setToast(null);
    const formData = new FormData();
    formData.append('image', selectedFile);
    try {
      const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server error occurred during detection.');
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Prepend data URI prefix so the img tag can render it directly
      const fullBase64Image = `data:image/jpeg;base64,${data.annotated_image}`;
      setAnnotatedImage(fullBase64Image);
      setDetections(data.detections || []);
      showToast('Object detection completed successfully!', 'success');
    } catch (err) {
      console.error('[Detection Request Failed]:', err);
      showToast(err.message || 'Failed to communicate with prediction backend.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-md border ${toast.type === 'success'
              ? 'bg-white border-emerald-100 text-emerald-800'
              : 'bg-white border-rose-100 text-rose-800'
            }`}>
            {toast.type === 'success' ? (
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto flex flex-col gap-10">

        {/* Header */}
        <header className="text-center">
          <span className="text-xs font-semibold tracking-wider text-blue-600 uppercase bg-blue-50 px-3 py-1.5 rounded-full inline-block mb-3">
            AI Research Laboratory
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Object Detection under Adverse Weather Conditions
          </h1>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
            Upload an image to detect objects using our custom YOLO model, specially calibrated for rain, fog, and low-light environments.
          </p>
        </header>

        {/* Upload State / Empty State */}
        {!previewUrl && (
          <main className="max-w-2xl mx-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-8 hover:shadow-md transition-all duration-300">
              <UploadZone
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                previewUrl={previewUrl}
                setPreviewUrl={setPreviewUrl}
                onClear={handleClear}
              />
            </div>
          </main>
        )}

        {/* Workspace State (File Uploaded) */}
        {previewUrl && (
          <main className="flex flex-col gap-8 animate-in fade-in duration-300">
            {/* Split Screen Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Card: Original Image */}
              <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-700">Original Image</h2>
                  </div>
                  <button
                    onClick={handleClear}
                    disabled={isLoading}
                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors font-medium disabled:opacity-50"
                  >
                    Clear Image
                  </button>
                </div>

                <div className="flex-1 bg-slate-50 flex items-center justify-center p-6 h-96 relative">
                  <img
                    src={previewUrl}
                    alt="Original Input"
                    className="max-w-full max-h-full object-contain rounded shadow-sm bg-white"
                  />
                </div>
              </section>

              {/* Right Card: Detection Result */}
              <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <h2 className="text-sm font-semibold text-slate-700">Detection Result</h2>
                  </div>
                </div>

                <div className="flex-1 bg-slate-50 flex items-center justify-center p-6 h-96 relative">
                  {isLoading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      <p className="text-xs font-medium text-slate-500">Running inference script...</p>
                    </div>
                  ) : annotatedImage ? (
                    <img
                      src={annotatedImage}
                      alt="Inference Detection Result"
                      className="max-w-full max-h-full object-contain rounded shadow-sm bg-white animate-in fade-in duration-300"
                    />
                  ) : (
                    <div className="text-center text-slate-400 max-w-[240px]">
                      <Play className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-medium">Original image loaded.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Click the "Detect Objects" button below to run the YOLO model.</p>
                    </div>
                  )}
                </div>
              </section>

            </div>

            {/* Inference Action Panel */}
            <div className="flex flex-col items-center gap-6 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
              {!annotatedImage && !isLoading && (
                <button
                  onClick={handleDetect}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                >
                  Detect Objects
                </button>
              )}

              {isLoading && (
                <button
                  disabled
                  className="px-6 py-3 bg-blue-600/85 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2.5 select-none"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Detection...
                </button>
              )}

              {annotatedImage && !isLoading && (
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleDetect}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    Run Detection Again
                  </button>
                  <button
                    onClick={handleClear}
                    className="px-5 py-2.5 border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-800 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none"
                  >
                    Upload New Image
                  </button>
                </div>
              )}

              {/* Detected Objects Section */}
              {annotatedImage && (
                <div className="w-full border-t border-slate-100 pt-6 animate-in fade-in duration-300">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">
                    Detected Objects
                  </h3>
                  <DetectionList detections={detections} />
                </div>
              )}
            </div>

          </main>
        )}

      </div>
    </div>
  );
}
