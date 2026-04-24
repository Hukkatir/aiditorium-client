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
import { getDisplayFileName, getFileExtension, getFileKind } from '../../utils/fileUtils';

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
    onRemove
}) => {
    if (!files.length) {
        return (
            <div className="rounded-3xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="grid gap-3">
            {files.map((file) => {
                const fileKind = getFileKind(file);
                const meta = FILE_KIND_META[fileKind] || FILE_KIND_META.file;
                const Icon = meta.icon;
                const fileName = getDisplayFileName(file);
                const extension = getFileExtension(fileName);
                return (
                    <div key={file.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                        <Link
                            to={buildFilePreviewPath(file.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-center gap-3 rounded-[18px] px-3 py-3 transition hover:bg-white/[0.05]"
                        >
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${meta.iconClass}`}>
                                <Icon className="h-5 w-5" />
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-white">{fileName}</div>
                                {extension && (
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                        <span className="rounded-full bg-white/10 px-2 py-0.5 uppercase tracking-[0.14em] text-slate-300">
                                            {extension}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <HiArrowTopRightOnSquare className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white" />
                        </Link>

                        {(onDownload || onRemove) && (
                            <div className="mt-2 flex flex-wrap gap-2 px-3 pb-1">
                                {onDownload && (
                                    <button
                                        type="button"
                                        onClick={() => onDownload(file)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/14"
                                    >
                                        <HiArrowDownTray className="h-4 w-4" />
                                        Скачать
                                    </button>
                                )}
                                {onRemove && (
                                    <button
                                        type="button"
                                        onClick={() => onRemove(file)}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/16"
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
