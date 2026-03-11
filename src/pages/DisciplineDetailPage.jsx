import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import MainLayout from '../components/layout/MainLayout';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import { HiCalendar, HiClock } from 'react-icons/hi2';

const DisciplineDetailPage = () => {
    const { disciplineId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [discipline, setDiscipline] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'feed'

    const fetchData = async () => {
        setLoading(true);
        try {
            // Получаем информацию о дисциплине
            const discData = await disciplineService.getDiscipline(disciplineId);
            const disciplineObj = discData.discipline || discData;
            setDiscipline(disciplineObj);

            // Получаем задания по дисциплине
            try {
                const tasksData = await taskService.getTasksByDiscipline(disciplineId);
                setTasks(tasksData.data || []);
            } catch (taskError) {
                console.error('Ошибка загрузки заданий', taskError);
                setTasks([]);
                // Можно показать тост, но не обязательно
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось загрузить данные дисциплины');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [disciplineId]);

    // Проверка прав (предполагаем, что у дисциплины есть поле created_by)
    const canManage = discipline && user && (discipline.created_by === user.id);

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

    const tabs = [
        { id: 'tasks', label: 'Задания' },
        { id: 'feed', label: 'Лента' },
    ];

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

                {/* Вкладки */}
                <div className="border-b border-white/10 mb-6">
                    <nav className="flex gap-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`pb-3 px-1 font-medium transition border-b-2 ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Контент вкладок */}
                {activeTab === 'tasks' && (
                    <div>
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

                        {tasks.length === 0 ? (
                            <p className="text-gray-500">В этой дисциплине пока нет заданий</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tasks.map(task => (
                                    <motion.div
                                        key={task.id}
                                        whileHover={{ y: -2 }}
                                        className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer"
                                        onClick={() => navigate(`/tasks/${task.id}`)}
                                    >
                                        <h3 className="text-xl font-bold mb-2">{task.name}</h3>
                                        <p className="text-gray-400 text-sm line-clamp-2">{task.description}</p>
                                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                            <span>Баллы: {task.scores || 0}</span>
                                            {task.deadline && (
                                                <span className="flex items-center gap-1">
                                                    <HiCalendar className="w-3 h-3" />
                                                    {new Date(task.deadline).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'feed' && (
                    <div>
                        <p className="text-gray-500">Здесь будет лента активности по дисциплине (скоро)</p>
                    </div>
                )}
            </div>

            {/* Модалка создания задания */}
            <CreateTaskModal
                isOpen={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                onSuccess={() => {
                    setShowCreateTask(false);
                    fetchData();
                }}
                courseId={discipline.course_id} // предполагаем, что у дисциплины есть course_id
                disciplineId={disciplineId}
            />
        </MainLayout>
    );
};

export default DisciplineDetailPage;