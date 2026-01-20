// Rodrigo Osorio v0.12 - Componente de imagen con lazy loading para mejor performance
// Reduce carga inicial y mejora tiempo de First Contentful Paint

import React, { useState, useEffect, useRef, memo } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
  placeholder?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Componente de imagen con lazy loading nativo del navegador
 * Usa Intersection Observer para cargar imágenes solo cuando son visibles
 * 
 * Beneficios:
 * - Reduce carga inicial de página
 * - Mejora First Contentful Paint (FCP)
 * - Ahorra ancho de banda
 * - Mejor experiencia en conexiones lentas
 */
export const LazyImage = memo(({ 
  src, 
  alt, 
  className = '', 
  fallback = 'https://via.placeholder.com/150?text=Image',
  placeholder,
  onLoad,
  onError
}: LazyImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholder || fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Usar Intersection Observer para lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoaded && !hasError) {
            // Cargar imagen cuando es visible
            const imageLoader = new Image();
            imageLoader.src = src;
            
            imageLoader.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
              onLoad?.();
            };
            
            imageLoader.onerror = () => {
              setImageSrc(fallback);
              setHasError(true);
              onError?.();
            };
            
            observer.unobserve(img);
          }
        });
      },
      {
        // Cargar cuando está a 50px de ser visible (preload)
        rootMargin: '50px',
      }
    );

    observer.observe(img);

    return () => {
      observer.disconnect();
    };
  }, [src, isLoaded, hasError, onLoad, onError, fallback]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={className}
      loading="lazy" // Fallback para navegadores que lo soportan
      style={{
        opacity: isLoaded ? 1 : 0.5,
        transition: 'opacity 0.3s ease-in-out',
      }}
    />
  );
});

LazyImage.displayName = 'LazyImage';

