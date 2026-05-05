import React from 'react';
import { X } from 'lucide-react';

type ImageModalProps = {
  enlargedImage: string | null;
  setEnlargedImage: (url: string | null) => void;
};

export function ImageModal({ enlargedImage, setEnlargedImage }: ImageModalProps) {
  if (!enlargedImage) return null;
  
  return (
    <div className="image-modal-overlay" onClick={() => setEnlargedImage(null)}>
      <img src={enlargedImage} className="image-modal-content" alt="Enlarged view" />
      <button className="close-modal-btn" onClick={() => setEnlargedImage(null)}>
        <X size={24} />
      </button>
    </div>
  );
}
