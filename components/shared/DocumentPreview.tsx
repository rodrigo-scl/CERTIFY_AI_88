// Componente DocumentPreview - Rodrigo Osorio v0.6
// Preview inline de documentos (PDF, imágenes)
import React, { useState, useCallback } from 'react';
import { X, ExternalLink, Download, FileText, Image as ImageIcon, File, Maximize2, Minimize2 } from 'lucide-react';
import { downloadFromUrl } from '../../services/storageService';

interface DocumentPreviewProps {
    url: string;
    fileName?: string;
    onClose?: () => void;
    className?: string;
}

// Detectar tipo de archivo
const getFileType = (url: string): 'pdf' | 'image' | 'other' => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.pdf')) return 'pdf';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg') || lowerUrl.includes('.png')) return 'image';
    return 'other';
};

// Componente de preview inline
export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
    url,
    fileName = 'Documento',
    onClose,
    className = ''
}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fileType = getFileType(url);

    const handleLoad = useCallback(() => {
        setIsLoading(false);
    }, []);

    const handleError = useCallback(() => {
        setIsLoading(false);
        setError('No se pudo cargar el documento');
    }, []);

    const handleDownload = async () => {
        try {
            await downloadFromUrl(url, fileName);
        } catch (err) {
            console.error('Error downloading:', err);
        }
    };

    const handleOpenExternal = () => {
        window.open(url, '_blank');
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Clases base y fullscreen
    const containerClasses = isFullscreen
        ? 'fixed inset-0 z-50 bg-slate-900/95 flex flex-col'
        : `relative bg-white rounded-2xl border border-slate-200 overflow-hidden ${className}`;

    return (
        <div className={containerClasses}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                    {fileType === 'pdf' && <FileText size={18} className="text-red-500 flex-shrink-0" />}
                    {fileType === 'image' && <ImageIcon size={18} className="text-blue-500 flex-shrink-0" />}
                    {fileType === 'other' && <File size={18} className="text-slate-500 flex-shrink-0" />}
                    <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                        title={isFullscreen ? 'Minimizar' : 'Pantalla completa'}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    <button
                        onClick={handleOpenExternal}
                        className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Abrir en nueva ventana"
                    >
                        <ExternalLink size={16} />
                    </button>

                    <button
                        onClick={handleDownload}
                        className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Descargar"
                    >
                        <Download size={16} />
                    </button>

                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-red-100 text-slate-600 hover:text-red-600 transition-colors ml-1"
                            title="Cerrar"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className={`flex-1 overflow-auto ${isFullscreen ? 'p-4' : ''}`}>
                {/* Loading state */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-slate-500">Cargando...</span>
                        </div>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <File size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">{error}</p>
                        <button
                            onClick={handleOpenExternal}
                            className="mt-2 text-brand-500 text-sm hover:underline"
                        >
                            Abrir en nueva ventana
                        </button>
                    </div>
                )}

                {/* PDF Preview */}
                {fileType === 'pdf' && !error && (
                    <iframe
                        src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
                        className={`w-full ${isFullscreen ? 'h-full' : 'h-[500px]'} border-0`}
                        title={fileName}
                        onLoad={handleLoad}
                        onError={handleError}
                    />
                )}

                {/* Image Preview */}
                {fileType === 'image' && !error && (
                    <div className={`flex items-center justify-center ${isFullscreen ? 'h-full' : 'h-[500px]'} bg-slate-100`}>
                        <img
                            src={url}
                            alt={fileName}
                            className="max-w-full max-h-full object-contain"
                            onLoad={handleLoad}
                            onError={handleError}
                        />
                    </div>
                )}

                {/* Other file types */}
                {fileType === 'other' && !error && (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                        <File size={48} className="mb-4 opacity-50" />
                        <p className="text-sm mb-2">Vista previa no disponible</p>
                        <button
                            onClick={handleOpenExternal}
                            className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm hover:bg-brand-600 transition-colors"
                        >
                            Abrir documento
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Modal para vista previa
interface DocumentPreviewModalProps {
    isOpen: boolean;
    url: string;
    fileName?: string;
    onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
    isOpen,
    url,
    fileName,
    onClose
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
                <DocumentPreview url={url} fileName={fileName} onClose={onClose} className="h-full" />
            </div>
        </div>
    );
};

export default DocumentPreview;
