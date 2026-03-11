import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import MainLayout from '../components/layout/MainLayout';
import CreateDisciplineModal from '../components/disciplines/CreateDisciplineModal';
import { HiClipboard, HiClipboardDocumentCheck, HiUserGroup, HiCalendar } from 'react-icons/hi2';
import apiClient from '../services/apiClient';

const CourseDetailPage = () => {
    const { courseId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [course, setCourse] = useState(null);
    const [disciplines, setDisciplines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDiscipline, setShowCreateDiscipline] = useState(false);
    const [copied, setCopied] = useState(false);
    const [coverUrl, setCoverUrl] = useState(null);
    const [loadingCover, setLoadingCover] = useState(false);
    const [activeTab, setActiveTab] = useState('feed'); // 'feed', 'disciplines', 'tasks'

    const fetchData = async () => {
        setLoading(true);
        try {
            const courseData = await courseService.getCourse(courseId);
            const courseObj = courseData.course || courseData;
            setCourse(courseObj);

            // Загружаем обложку, если есть ID
            if (courseObj.background_logo_url) {
                setCoverUrl(courseObj.background_logo_url);
            } else if (courseObj.background_logo_id) {
                setLoadingCover(true);
                try {
                    const fileRes = await apiClient.get(`/file/${courseObj.background_logo_id}`);
                    const path = fileRes.data.file?.path || fileRes.data.path;
                    if (path) {
                        setCoverUrl(`https://aiditorium.ru/storage/${path}`);
                    }
                } catch (err) {
                    console.error('Ошибка загрузки обложки', err);
                } finally {
                    setLoadingCover(false);
                }
            }

            // Загружаем дисциплины (временно, для вкладки дисциплин)
            try {
                const disciplinesData = await disciplineService.getDisciplinesByCourse(courseId);
                setDisciplines(disciplinesData.data || []);
            } catch (err) {
                console.error('Ошибка загрузки дисциплин', err);
                setDisciplines([]);
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось загрузить данные курса');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [courseId]);

    const handleCopyInviteCode = () => {
        navigator.clipboard.writeText(course.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast('success', 'Код скопирован');
    };

    const canManage = course && user && (course.creator_id === user.id || course.pivot?.role === 'teacher');

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MainLayout>
        );
    }

    if (!course) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <p className="text-gray-400 text-xl">Курс не найден</p>
                    <button
                        onClick={() => navigate('/courses')}
                        className="mt-4 text-purple-400 hover:text-purple-300"
                    >
                        ← Вернуться к курсам
                    </button>
                </div>
            </MainLayout>
        );
    }

    // Вкладки
    const tabs = [
        { id: 'feed', label: 'Лента' },
        { id: 'disciplines', label: 'Дисциплины' },
        { id: 'tasks', label: 'Задания', disabled: true } // пока скрыто
    ];

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                {/* Вкладки навигации */}
                <div className="border-b border-white/10 mb-6">
                    <nav className="flex gap-6">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => !tab.disabled && setActiveTab(tab.id)}
                                className={`pb-3 px-1 font-medium transition border-b-2 ${
                                    activeTab === tab.id
                                        ? 'border-purple-500 text-purple-400'
                                        : 'border-transparent text-gray-400 hover:text-white'
                                } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={tab.disabled}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Контент вкладок */}
                {activeTab === 'feed' && (
                    <div>
                        {/* Обложка с наложенным текстом */}
                        <div className="relative w-full h-64 mb-6 rounded-2xl overflow-hidden">
                            {coverUrl ? (
                                <img src={coverUrl} alt={course.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-6">
                                <h1 className="text-4xl font-bold text-white mb-2">{course.name}</h1>
                                <p className="text-gray-200 text-lg max-w-2xl">{course.description}</p>
                            </div>
                        </div>

                        {/* Информация о курсе и код приглашения */}
                        <div className="flex items-center justify-between mb-8 bg-white/5 p-4 rounded-xl">
                            <div className="flex items-center gap-4">
                                {/*<HiUserGroup className="w-6 h-6 text-gray-400" />
                                <span className="text-gray-300">Участников: {course.users_count || '—'}</span>
                                */}<HiCalendar className="w-6 h-6 text-gray-400 ml-4" />
                                <span className="text-gray-300">Создан: {new Date(course.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div>
                                    <span className="text-sm text-gray-500">Код приглашения:</span>
                                    <code className="ml-2 px-3 py-1 bg-purple-600/20 rounded-lg text-purple-300 font-mono">
                                        {course.invite_code}
                                    </code>
                                </div>
                                <button onClick={handleCopyInviteCode} className="p-2 hover:bg-white/10 rounded-lg transition">
                                    {copied ? <HiClipboardDocumentCheck className="w-5 h-5 text-green-400" /> : <HiClipboard className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Лента активностей (пока заглушка) */}
                        <div className="space-y-4">
                            <h2 className="text-2xl font-semibold">Последние обновления</h2>
                            {canManage && (
                                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 text-center">
                                    <p className="text-gray-400">Здесь будут появляться новые задания и объявления</p>
                                    <button className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">
                                        + Создать объявление
                                    </button>

                                </div>


                            )}
                            {!canManage && (
                                <p className="text-gray-500">Пока нет активностей</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'disciplines' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-semibold">Дисциплины курса</h2>
                            {canManage && (
                                <button
                                    onClick={() => setShowCreateDiscipline(true)}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                                >
                                    + Создать дисциплину
                                </button>
                            )}
                        </div>

                        {disciplines.length === 0 ? (
                            <p className="text-gray-500">В этом курсе пока нет дисциплин</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {disciplines.map(discipline => (
                                    <motion.div
                                        key={discipline.id}
                                        whileHover={{ y: -2 }}
                                        className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer"
                                        onClick={() => navigate(`/disciplines/${discipline.id}`)}
                                    >
                                        <h3 className="text-xl font-bold mb-2">{discipline.name}</h3>
                                        <p className="text-gray-400 text-sm line-clamp-2">{discipline.description}</p>
                                        <div className="mt-3 text-xs text-gray-500">
                                            Часов: {discipline.hours || 0}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div>
                        <p className="text-gray-500">Раздел в разработке</p>
                    </div>
                )}
            </div>

            {/* Модалка создания дисциплины */}
            <CreateDisciplineModal
                isOpen={showCreateDiscipline}
                onClose={() => setShowCreateDiscipline(false)}
                onSuccess={() => {
                    setShowCreateDiscipline(false);
                    fetchData();
                }}
                courseId={courseId}
            />
        </MainLayout>
    );
};

export default CourseDetailPage;