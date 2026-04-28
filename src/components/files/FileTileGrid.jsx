import React from 'react';
import { Link } from 'react-router-dom';
import {
    HiArchiveBox,
    HiArrowDownTray,
    HiArrowTopRightOnSquare,
    HiCodeBracket,
    HiDocument,
    HiDocumentText,
    HiFilm,
    HiMusicalNote,
    HiPaperClip,
    HiPhoto,
    HiPresentationChartBar,
    HiTableCells,
    HiTrash
} from 'react-icons/hi2';
import { buildFilePreviewPath } from '../../utils/routeUtils';
import { getDisplayFileName, getFileKind } from '../../utils/fileUtils';

const FILE_KIND_META = {
    image: { icon: HiPhoto, iconClass: 'bg-fuchsia-500/12 text-fuchsia-200' },
    pdf: { icon: HiDocumentText, iconClass: 'bg-rose-500/12 text-rose-200' },
    video: { icon: HiFilm, iconClass: 'bg-purple-500/12 text-purple-200' },
    audio: { icon: HiMusicalNote, iconClass: 'bg-amber-500/12 text-amber-200' },
    archive: { icon: HiArchiveBox, iconClass: 'bg-orange-500/12 text-orange-200' },
    spreadsheet: { icon: HiTableCells, iconClass: 'bg-emerald-500/12 text-emerald-200' },
    presentation: { icon: HiPresentationChartBar, iconClass: 'bg-violet-500/12 text-violet-200' },
    text: { icon: HiDocumentText, iconClass: 'bg-slate-500/12 text-slate-200' },
    code: { icon: HiCodeBracket, iconClass: 'bg-cyan-500/12 text-cyan-200' },
    document: { icon: HiDocument, iconClass: 'bg-indigo-500/12 text-indigo-200' },
    file: { icon: HiPaperClip, iconClass: 'bg-white/10 text-slate-200' }
};

const FileTileGrid = ({
    files,
    emptyMessage,
    onDownload,
    onRemove,
    compact = false
}) => {
    if (!files.length) {
        return (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className={compact ? 'grid gap-2' : 'grid gap-3'}>
            {files.map((file) => {
                const fileKind = getFileKind(file);
                const meta = FILE_KIND_META[fileKind] || FILE_KIND_META.file;
                const Icon = meta.icon;
                const fileName = getDisplayFileName(file);

                return (
                    <div key={file.id} className={`rounded-xl border border-white/10 bg-white/[0.03] ${compact ? 'p-1' : 'p-2'}`}>
                        <div className="flex min-w-0 items-center gap-1.5">
                            <Link
                                to={buildFilePreviewPath(file.id)}
                                target="_blank"
                                rel="noreferrer"
                                className={`group flex min-w-0 flex-1 items-center gap-3 rounded-xl transition hover:bg-white/[0.05] ${compact ? 'px-2 py-2' : 'px-3 py-3'}`}
                            >
                                <div className={`flex shrink-0 items-center justify-center rounded-xl ${meta.iconClass} ${compact ? 'h-8 w-8' : 'h-11 w-11'}`}>
                                    <Icon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className={`truncate text-white ${compact ? 'text-[13px] font-medium' : 'text-sm font-medium'}`}>{fileName}</div>
                                </div>

                                <HiArrowTopRightOnSquare className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white" />
                            </Link>

                            {compact && onDownload && (
                                <button
                                    type="button"
                                    onClick={() => onDownload(file)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition hover:bg-white/15"
                                    title="Скачать"
                                >
                                    <HiArrowDownTray className="h-4 w-4" />
                                </button>
                            )}
                            {compact && onRemove && (
                                <button
                                    type="button"
                                    onClick={() => onRemove(file)}
                                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-200 transition hover:bg-red-500/20"
                                    title="Убрать"
                                >
                                    <HiTrash className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {!compact && (onDownload || onRemove) && (
                            <div className="mt-2 flex flex-wrap gap-2 px-3 pb-1">
                                {onDownload && (
                                    <button
                                        type="button"
                                        onClick={() => onDownload(file)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/15"
                                    >
                                        <HiArrowDownTray className="h-4 w-4" />
                                        Скачать
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(file)}
                                        className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                                    >
                                        <HiTrash className="h-4 w-4" />
                                        Убрать
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default FileTileGrid;
