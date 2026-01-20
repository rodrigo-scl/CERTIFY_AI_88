// Hook useUploadProgress - Rodrigo Osorio v0.6
// Tracking de progreso de carga de archivos
import React, { useState, useCallback } from 'react';

export interface UploadProgress {
    progress: number;      // 0-100
    isUploading: boolean;
    fileName: string | null;
    error: string | null;
}

interface UseUploadProgressReturn {
    uploadProgress: UploadProgress;
    startUpload: (fileName: string) => void;
    updateProgress: (progress: number) => void;
    completeUpload: () => void;
    failUpload: (error: string) => void;
    resetUpload: () => void;
}

const initialState: UploadProgress = {
    progress: 0,
    isUploading: false,
    fileName: null,
    error: null
};

export const useUploadProgress = (): UseUploadProgressReturn => {
    const [uploadProgress, setUploadProgress] = useState<UploadProgress>(initialState);

    const startUpload = useCallback((fileName: string) => {
        setUploadProgress({
            progress: 0,
            isUploading: true,
            fileName,
            error: null
        });
    }, []);

    const updateProgress = useCallback((progress: number) => {
        setUploadProgress(prev => ({
            ...prev,
            progress: Math.min(Math.max(progress, 0), 100)
        }));
    }, []);

    const completeUpload = useCallback(() => {
        setUploadProgress(prev => ({
            ...prev,
            progress: 100,
            isUploading: false
        }));

        // Reset después de 2 segundos
        setTimeout(() => {
            setUploadProgress(initialState);
        }, 2000);
    }, []);

    const failUpload = useCallback((error: string) => {
        setUploadProgress(prev => ({
            ...prev,
            isUploading: false,
            error
        }));
    }, []);

    const resetUpload = useCallback(() => {
        setUploadProgress(initialState);
    }, []);

    return {
        uploadProgress,
        startUpload,
        updateProgress,
        completeUpload,
        failUpload,
        resetUpload
    };
};

// Componente UploadProgressBar
interface UploadProgressBarProps {
    progress: number;
    isUploading: boolean;
    fileName?: string | null;
    error?: string | null;
    className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
    progress,
    isUploading,
    fileName,
    error,
    className = ''
}) => {
    if (!isUploading && !error && progress === 0) {
        return null;
    }

    return (
        <div className={`w-full ${className}`}>
            {/* File name */}
            {fileName && isUploading && (
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">{fileName}</span>
                    <span className="text-xs font-medium text-brand-600">{progress}%</span>
                </div>
            )}

            {/* Progress bar */}
            <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                    className={`absolute inset-y-0 left-0 transition-all duration-300 ease-out rounded-full ${error
                        ? 'bg-red-500'
                        : progress === 100
                            ? 'bg-green-500'
                            : 'bg-brand-500'
                        }`}
                    style={{ width: `${progress}%` }}
                />

                {/* Animated shimmer during upload */}
                {isUploading && !error && (
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                        style={{
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite'
                        }}
                    />
                )}
            </div>

            {/* Error message */}
            {error && (
                <p className="mt-1 text-xs text-red-500">{error}</p>
            )}

            {/* Success message */}
            {progress === 100 && !isUploading && !error && (
                <p className="mt-1 text-xs text-green-600">¡Subido correctamente!</p>
            )}
        </div>
    );
};

export default useUploadProgress;
