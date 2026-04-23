import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowDownTray, HiArrowLeft, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import FilePreviewSurface from '../components/files/FilePreviewSurface';
import MainLayout from '../components/layout/MainLayout';
import { useToast } from '../context/ToastContext';
import { fileService } from '../services/fileService';
import { getFileTypeLabel } from '../utils/fileUtils';

const FilePreviewPage = () => {
    const { fileId } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);

    const fileTypeLabel = useMemo(() => getFileTypeLabel({
        name: preview?.fileName,
        contentType: preview?.contentType
    }), [preview]);

    useEffect(() => {
        let cancelled = false;

        const loadPreview = async () => {
            setLoading(true);

            try {
                const nextPreview = await fileService.getFilePreview(fileId, `file-${fileId}`);

                if (cancelled) {
                    if (nextPreview?.objectUrl) {
                        window.URL.revokeObjectURL(nextPreview.objectUrl);
                    }
                    return;
                }

                setPreview((current) => {
                    if (current?.objectUrl) {
                        window.URL.revokeObjectURL(current.objectUrl);
                    }

                    return nextPreview;
                });
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    showToast('error', 'Не удалось загрузить предпросмотр файла');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadPreview();

        return () => {
            cancelled = true;
        };
    }, [fileId, showToast]);

    useEffect(() => () => {
        if (preview?.objectUrl) {
            window.URL.revokeObjectURL(preview.objectUrl);
        }
    }, [preview]);

    const handleDownload = async () => {
        try {
            await fileService.downloadFile(fileId, preview?.fileName || `file-${fileId}`);
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось скачать файл');
        }
    };

    const handleOpenOriginal = async () => {
        try {
            await fileService.openFile(fileId, preview?.fileName || `file-${fileId}`);
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось открыть файл');
        }
    };

    return (
        <MainLayout>
            <div className="mx-auto max-w-6xl space-y-6">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
                >
                    <HiArrowLeft className="h-5 w-5" />
                    Назад
                </button>

                <section className="rounded-[34px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_34%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="max-w-3xl">
                            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-400">
                                {fileTypeLabel}
                            </div>
                            <h1 className="mt-4 text-3xl font-semibold text-white md:text-4xl">
                                {preview?.fileName || 'Предпросмотр файла'}
                            </h1>
                            <p className="mt-3 text-sm leading-7 text-slate-400 md:text-base">
                                Здесь можно быстро посмотреть содержимое файла и при необходимости открыть его напрямую или скачать.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleOpenOriginal}
                                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                            >
                                <HiArrowTopRightOnSquare className="h-4 w-4" />
                                Открыть напрямую
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                            >
                                <HiArrowDownTray className="h-4 w-4" />
                                Скачать
                            </button>
                        </div>
                    </div>
                </section>

                <section className="overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.02]">
                    <FilePreviewSurface preview={preview} loading={loading} />
                </section>
            </div>
        </MainLayout>
    );
};

export default FilePreviewPage;
