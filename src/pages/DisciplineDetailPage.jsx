import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import MainLayout from '../components/layout/MainLayout';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import { HiClock, HiCalendar, HiStar } from 'react-icons/hi2';

const DisciplineDetailPage = () => {
    const { disciplineId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [discipline, setDiscipline] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTask, setShowCreateTask] = useState(false);

    const fetchDiscipline = async () => {
        try {
            const discData = await disciplineService.getDiscipline(disciplineId);
            setDiscipline(discData.discipline || discData);
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось загрузить данные дисциплины');
            throw error;
        }
    };

    const fetchTasks = async (courseId) => {
        try {
            // Получаем все задания курса
            const tasksData = await taskService.getTasks({ course_id: courseId });
            // Фильтруем по discipline_id
            const filtered = tasksData.data.filter(task => task.discipline_id === parseInt(disciplineId));
            setTasks(filtered);
        } catch (error) {
            console.error('Ошибка загрузки заданий', error);
            setTasks([]);
            showToast('error', 'Не удалось загрузить задания');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            await fetchDiscipline();
            // После загрузки дисциплины знаем course_id
            if (discipline) {
                await fetchTasks(discipline.course_id);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [disciplineId]);

    // Повторный вызов при изменении discipline (после первой загрузки)
    useEffect(() => {
        if (discipline) {
            fetchTasks(discipline.course_id);
        }
    }, [discipline]);

    const canManage = discipline && user && (
        discipline.created_by === user.id || discipline.pivot?.role === 'teacher'
    );

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MainLayout>
        );
    }

    if (!discipline) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <p className="text-gray-400 text-xl">Дисциплина не найдена</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 text-purple-400 hover:text-purple-300"
                    >
                        ← Назад
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                {/* Кнопка назад */}
                <button
                    onClick={() => navigate(-1)}
                    className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                    ← Назад к курсу
                </button>

                {/* Заголовок дисциплины */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">{discipline.name}</h1>
                    <p className="text-gray-400 mt-1">{discipline.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <HiClock className="w-4 h-4" />
                            Часов: {discipline.hours || 0}
                        </span>
                    </div>
                </div>

                {/* Заголовок с кнопкой создания задания */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold">Задания</h2>
                    {canManage && (
                        <button
                            onClick={() => setShowCreateTask(true)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                        >
                            + Создать задание
                        </button>
                    )}
                </div>

                {/* Список заданий */}
                {tasks.length === 0 ? (
                    <p className="text-gray-500">В этой дисциплине пока нет заданий</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tasks.map(task => (
                            <motion.div
                                key={task.id}
                                whileHover={{ y: -4 }}
                                className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition-all"
                                onClick={() => navigate(`/tasks/${task.id}`)}
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
                                            <HiCalendar className="w-3 h-3" />
                                            Срок здачи: {new Date(task.deadline).toLocaleDateString()}
                                        </span>
                                    )}

                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Модалка создания задания */}
            <CreateTaskModal
                isOpen={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                onSuccess={() => {
                    setShowCreateTask(false);
                    // После создания задания обновляем список, используя course_id
                    if (discipline) {
                        fetchTasks(discipline.course_id);
                    }
                }}
                courseId={discipline?.course_id}
                disciplineId={disciplineId}
            />
        </MainLayout>
    );
};

export default DisciplineDetailPage;