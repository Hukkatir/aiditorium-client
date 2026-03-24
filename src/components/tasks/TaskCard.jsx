import React from 'react';
import { motion } from 'framer-motion';
import { HiStar, HiClock, HiCalendar, HiRectangleStack } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { buildTaskPath } from '../../utils/routeUtils';

const TaskCard = ({ task, course, discipline, disciplineName }) => {
    const navigate = useNavigate();

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition-all"
            onClick={() => navigate(buildTaskPath(course, discipline, task))}
        >
            <h3 className="text-lg font-bold mb-2">{task.name}</h3>
            <p className="text-gray-400 text-sm line-clamp-2 mb-3">{task.description}</p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {task.scores !== undefined && (
                    <span className="flex items-center gap-1">
                        <HiStar className="w-3 h-3 text-yellow-400" />
                        {task.scores} баллов
                    </span>
                )}
                {task.deadline && (
                    <span className="flex items-center gap-1">
                        <HiClock className="w-3 h-3" />
                        Дедлайн: {formatDate(task.deadline)}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <HiCalendar className="w-3 h-3" />
                    Создано: {formatDate(task.created_at)}
                </span>
                {disciplineName && (
                    <span className="flex items-center gap-1">
                        <HiRectangleStack className="w-3 h-3" />
                        {disciplineName}
                    </span>
                )}
            </div>
        </motion.div>
    );
};

export default TaskCard;
