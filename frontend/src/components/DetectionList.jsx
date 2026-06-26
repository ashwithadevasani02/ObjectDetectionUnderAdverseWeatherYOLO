import React from 'react';
export default function DetectionList({ detections }) {
  if (!detections || detections.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm border border-slate-100 rounded-xl bg-slate-50/30">
        No objects detected in the image.
      </div>
    );
  }
  // Sort detections by confidence descending
  const sortedDetections = [...detections].sort((a, b) => b.confidence - a.confidence);
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2.5">
        {sortedDetections.map((det, index) => {
          const percentage = Math.round(det.confidence * 100);
          return (
            <div
              key={`${det.class}-${index}`}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-300 shadow-sm text-sm font-medium text-slate-700 select-none transition-all duration-200"
            >
              <span className="text-slate-800 font-medium">{det.class}</span>
              <span className="h-4 w-px bg-slate-200"></span>
              <span className="text-blue-600 font-semibold">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
