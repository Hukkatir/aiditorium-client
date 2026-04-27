import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    HiCalendar,
    HiMiniRectangleStack,
    HiPaperClip,
    HiStar
} from 'react-icons/hi2';
import ActionMenu from '../layout/ActionMenu';
import { buildTaskPath } from '../../utils/routeUtils';
import { getRichTextExcerpt } from '../../utils/richText';
import { formatTaskDate } from '../../utils/taskPresentation';

const TaskCard = ({
    task,
    course,
    discipline,
    layout = 'grid',
    creatorName = '',
    disciplineLabel = '',
    courseLabel = '',
    status = null,
    grade = null,
    maxScore = Number(task?.scores) || 100,
    materialsCount = 0,
    actionItems = [],
    extraChips = [],
    descriptionFallback = 'Откройте задание, чтобы посмотреть полное описание и материалы.'
}) => {
    const navigate = useNavigate();
    const excerpt = getRichTextExcerpt(task?.description, layout === 'grid' ? 170 : 260);
    const isList = layout === 'list';

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`cursor-pointer rounded-2xl border border-white/10 bg-[#1A1A1C] transition-all hover:border-purple-400/25 hover:bg-[#1D1B24] ${
                isList ? 'p-4 md:p-5' : 'p-5'
            }`}
            onClick={() => course && discipline && navigate(buildTaskPath(course, discipline, task))}
        >
            <div className={`flex ${isList ? 'flex-col gap-4 md:flex-row md:items-start md:justify-between' : 'items-start justify-between gap-3'}`}>
                <div className="min-w-0 flex-1">
                    {courseLabel && (
                        <p className="text-sm text-slate-500">
                            {courseLabel}
                        </p>
                    )}

                    {disciplineLabel && (
                        <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-purple-400/15 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
                            <HiMiniRectangleStack className="h-3.5 w-3.5" />
                            {disciplineLabel}
                        </span>
                    )}

                    <h3 className={`text-white ${disciplineLabel || courseLabel ? 'mt-3' : ''} ${isList ? 'text-lg md:text-xl' : 'text-xl'}`}>
                        {task?.name}
                    </h3>

                    {creatorName && (
                        <p className="mt-2 text-sm text-slate-400">
                            Создал: {creatorName}
                        </p>
                    )}

                    <p className={`mt-3 text-sm leading-6 text-slate-400 ${isList ? 'line-clamp-2' : 'line-clamp-3'}`}>
                        {excerpt || descriptionFallback}
                    </p>
                </div>

                {actionItems.length > 0 && (
                    <div className="self-start">
                        <ActionMenu
                            buttonClassName="border border-white/10 bg-white/5"
                            items={actionItems}
                        />
                    </div>
                )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-xs">
                {status && (
                    <span className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 ${status.className}`}>
                        {status.label}
                    </span>
                )}

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                    <HiCalendar className="h-3.5 w-3.5" />
                    {formatTaskDate(task?.deadline)}
                </span>

                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-slate-300">
                    <HiPaperClip className="h-3.5 w-3.5" />
                    Материалов: {materialsCount}
                </span>

                {grade ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                        <HiStar className="h-3.5 w-3.5" />
                        Оценка: {grade.grade}/{maxScore}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-purple-500/10 px-3 py-1.5 text-purple-200">
                        <HiStar className="h-3.5 w-3.5" />
                        Баллы: {maxScore}
                    </span>
                )}

                {extraChips.map((chip) => {
                    const Icon = chip.icon;

                    return (
                        <span key={chip.key} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${chip.className || 'bg-white/10 text-slate-300'}`}>
                            {Icon && <Icon className="h-3.5 w-3.5" />}
                            {chip.label}
                        </span>
                    );
                })}
            </div>
        </motion.div>
    );
};

export default TaskCard;
