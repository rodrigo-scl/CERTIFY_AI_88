import { useEffect, useRef } from 'react';

// Rodrigo Osorio v1.0 - Hook para actualizar favicon dinámicamente
export const useFaviconBadge = (count: number) => {
    const faviconRef = useRef<HTMLLinkElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const originalFavicon = useRef<string>('');

    useEffect(() => {
        // 1. Inicialización
        if (!faviconRef.current) {
            const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
            if (link) {
                faviconRef.current = link;
                originalFavicon.current = link.href;
            }
        }

        // 2. Si no hay notificaciones, restaurar favicon original
        if (count === 0) {
            if (faviconRef.current && originalFavicon.current) {
                faviconRef.current.href = originalFavicon.current;
            }
            return;
        }

        // 3. Crear canvas si no existe
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            canvasRef.current.width = 32;
            canvasRef.current.height = 32;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || !faviconRef.current) return;

        // 4. Cargar imagen base y dibujar badge
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Evitar problemas de CORS
        img.src = originalFavicon.current;

        img.onload = () => {
            // Limpiar canvas
            ctx.clearRect(0, 0, 32, 32);

            // Dibujar favicon original (escalado a 32x32)
            ctx.drawImage(img, 0, 0, 32, 32);

            // Configurar BADGE ESTILO GMAIL (Grande y Visible)
            if (count > 0) {
                // Definir texto y tamaño
                const text = count > 99 ? '99+' : count.toString();

                // Configurar fuente primero para medir ancho
                ctx.font = 'bold 18px Arial, sans-serif';
                const textWidth = ctx.measureText(text).width;

                // Dimensiones del badge (adaptable al ancho del texto)
                const padding = 4;
                const badgeHeight = 20;
                const badgeWidth = Math.max(badgeHeight, textWidth + padding * 2);

                // Posición: Esquina Superior Derecha (Top-Right)
                // Permitimos que se "salga" un poco visualmente para maximizar espacio
                const x = 32 - badgeWidth + 2; // +2 para pegarlo bien al borde derecho
                const y = -2; // -2 para subirlo al borde superior

                // Dibujar Rectángulo Redondeado (Pill Shape)
                const radius = 8;
                ctx.beginPath();
                ctx.roundRect(x, y, badgeWidth, badgeHeight, radius);
                ctx.fillStyle = '#D93025'; // Gmail Red
                ctx.fill();

                // Borde blanco para separar del icono
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Dibujar Texto
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Ajuste fino vertical para centrar visualmente en la "píldora"
                ctx.fillText(text, x + badgeWidth / 2, y + badgeHeight / 2 + 1);
            }

            // Reemplazar favicon
            faviconRef.current!.href = canvas.toDataURL('image/png');
        };

    }, [count]);
};
