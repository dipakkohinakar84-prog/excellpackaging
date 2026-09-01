import React, { useState, useEffect } from 'react';

interface DrawingPdfPreviewProps {
  url: string;
  className?: string;
}

export default function DrawingPdfPreview({ url, className }: DrawingPdfPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let revoked = false;
    setLoading(true);
    setError(false);
    setObjectUrl(null);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.blob();
      })
      .then(blob => {
        if (!revoked) {
          setObjectUrl(URL.createObjectURL(blob));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!revoked) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      revoked = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-xl border ${className || 'w-full h-[70vh]'}`}>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading PDF...</p>
      </div>
    );
  }

  if (error || !objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-xl border ${className || 'w-full h-[70vh]'}`}>
        <p className="text-sm font-bold text-red-400 uppercase tracking-widest">Failed to load PDF.</p>
      </div>
    );
  }

  return (
    <iframe
      src={objectUrl}
      title="Drawing PDF"
      className={className || 'w-full h-[70vh] rounded-xl border shadow-xl bg-white'}
    />
  );
}
