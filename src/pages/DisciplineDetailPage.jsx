import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import MainLayout from '../components/layout/MainLayout';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import { HiCalendar, HiClock, HiStar } from 'react-icons/hi2';
import { buildCoursePath, buildTaskPath } from '../utils/routeUtils';

const DisciplineDetailPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [discipline, setDiscipline] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTask, setShowCreateTask] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const disciplineData = await disciplineService.getDiscipline(courseIdOrSlug, disciplineIdOrSlug);
            const disciplineObj = disciplineData.discipline || disciplineData;
            setDiscipline(disciplineObj);

            try {
                const tasksData = await taskService.getTasks({
                    course_id: disciplineObj.course_id,
                    discipline_id: disciplineObj.id,
                    per_page: 100
                });
                setTasks(tasksData.data || []);
            } catch (error) {
                setTasks(error.response?.status === 404 ? [] : []);
            }
        } catch (error) {
            console.error(error);
            setDiscipline(null);
            showToast('error', 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ РґРёСЃС†РёРїР»РёРЅС‹');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [courseIdOrSlug, disciplineIdOrSlug]);

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
                    <p className="text-gray-400 text-xl">Р”РёСЃС†РёРїР»РёРЅР° РЅРµ РЅР°Р№РґРµРЅР°</p>
                    <button onClick={() => navigate('/courses')} className="mt-4 text-purple-400 hover:text-purple-300">
                        в†ђ РќР°Р·Р°Рґ
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate(buildCoursePath({ id: discipline.course_id, slug: courseIdOrSlug }))}
                    className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                    в†ђ РќР°Р·Р°Рґ Рє РєСѓСЂСЃСѓ
                </button>

                <div className="mb-6">
                    <h1 className="text-3xl font-bold">{discipline.name}</h1>
                    <p className="text-gray-400 mt-1">{discipline.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                            <HiClock className="w-4 h-4" />
                            Р§Р°СЃРѕРІ: {discipline.hours || 0}
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold">Р—Р°РґР°РЅРёСЏ</h2>
                    {canManage && (
                        <button
                            onClick={() => setShowCreateTask(true)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                        >
                            + РЎРѕР·РґР°С‚СЊ Р·Р°РґР°РЅРёРµ
                        </button>
                    )}
                </div>

                {tasks.length === 0 ? (
                    <p className="text-gray-500">Р’ СЌС‚РѕР№ РґРёСЃС†РёРїР»РёРЅРµ РїРѕРєР° РЅРµС‚ Р·Р°РґР°РЅРёР№</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tasks.map(task => (
                            <motion.div
                                key={task.id}
                                whileHover={{ y: -4 }}
                                className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition-all"
                                onClick={() => navigate(buildTaskPath({ id: discipline.course_id, slug: courseIdOrSlug }, discipline, task))}
                            >
                                <h3 className="text-lg font-bold mb-2">{task.name}</h3>
                                <p className="text-gray-400 text-sm line-clamp-2 mb-3">{task.description}</p>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                    {task.scores !== undefined && (
                                        <span className="flex items-center gap-1">
                                            <HiStar className="w-3 h-3 text-yellow-400" />
                                            {task.scores} Р±Р°Р»Р»РѕРІ
                                        </span>
                                    )}
                                    {task.deadline && (
                                        <span className="flex items-center gap-1">
                                            <HiCalendar className="w-3 h-3" />
                                            РЎСЂРѕРє Р·РґР°С‡Рё: {new Date(task.deadline).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <CreateTaskModal
                isOpen={showCreateTask}
                onClose={() => setShowCreateTask(false)}
                onSuccess={() => {
                    setShowCreateTask(false);
                    fetchData();
                }}
                courseId={discipline.course_id}
                disciplineId={discipline.id}
            />
        </MainLayout>
    );
};

export default DisciplineDetailPage;
