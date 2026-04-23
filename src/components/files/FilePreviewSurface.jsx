import React from 'react';
import { HiDocumentText, HiFilm, HiPaperClip, HiPhoto } from 'react-icons/hi2';
import { getFileKind } from '../../utils/fileUtils';

const FilePreviewSurface = ({ preview, loading = false }) => {
    const previewKind = getFileKind({
        name: preview?.fileName,
        contentType: preview?.contentType
    });

    if (loading) {
        return (
            <div className="flex h-[520px] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
        );
    }

    if (!preview?.objectUrl) {
        return (
            <div className="flex h-[420px] flex-col items-center justify-center px-6 text-center">
                <HiPaperClip className="h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-medium text-white">Не удалось загрузить предпросмотр</p>
                <p className="mt-2 max-w-md text-sm text-slate-400">
                    Файл все равно можно скачать или открыть напрямую.
                </p>
            </div>
        );
    }

    if (previewKind === 'image') {
        return (
            <img
                src={preview.objectUrl}
                alt={preview.fileName}
                className="max-h-[620px] w-full object-contain bg-black/30"
            />
        );
    }

    if (previewKind === 'pdf') {
        return (
            <iframe
                title={preview.fileName}
                src={preview.objectUrl}
                className="h-[620px] w-full bg-white"
            />
        );
    }

    if (previewKind === 'video') {
        return (
            <video controls className="max-h-[620px] w-full bg-black">
                <source src={preview.objectUrl} type={preview.contentType} />
            </video>
        );
    }

    if (previewKind === 'text') {
        return (
            <iframe
                title={preview.fileName}
                src={preview.objectUrl}
                className="h-[620px] w-full bg-white"
            />
        );
    }

    return (
        <div className="flex h-[420px] flex-col items-center justify-center px-6 text-center">
            {previewKind === 'document' ? (
                <HiDocumentText className="h-10 w-10 text-slate-400" />
            ) : previewKind === 'video' ? (
                <HiFilm className="h-10 w-10 text-slate-400" />
            ) : previewKind === 'image' ? (
                <HiPhoto className="h-10 w-10 text-slate-400" />
            ) : (
                <HiPaperClip className="h-10 w-10 text-slate-400" />
            )}
            <p className="mt-4 text-lg font-medium text-white">{preview.fileName}</p>
            <p className="mt-2 max-w-md text-sm text-slate-400">
                Для этого формата встроенный просмотр недоступен. Откройте файл напрямую или скачайте его.
            </p>
        </div>
    );
};

export default FilePreviewSurface;
