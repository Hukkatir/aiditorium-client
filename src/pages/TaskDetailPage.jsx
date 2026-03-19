// src/pages/TaskDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { taskService } from '../services/taskService';
import { courseService } from '../services/courseService';
import { userService } from '../services/userService';
import MainLayout from '../components/layout/MainLayout';
import EditTaskModal from '../components/tasks/EditTaskModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import {
    HiArrowLeft,
    HiStar,
    HiCalendar,
    HiClock,
    HiPaperClip,
    HiPencil,
    HiTrash,
    HiUserCircle
} from 'react-icons/hi2';
import apiClient from '../services/apiClient';

const formatDateTime = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const TaskDetailPage = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [creator, setCreator] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitFile, setSubmitFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [course, setCourse] = useState(null);

    const fetchTask = async () => {
        try {
            const data = await taskService.getTask(taskId);
            const taskObj = data.task || data;
            setTask(taskObj);

            if (taskObj.course_id) {
                const courseData = await courseService.getCourse(taskObj.course_id);
                setCourse(courseData.course || courseData);
            }

            if (taskObj.user_id && taskObj.user_id !== user?.id) {
                try {
                    const userData = await userService.getUser(taskObj.user_id);
                    setCreator(userData.user || userData);
                } catch (err) {
                    console.error('Не удалось загрузить создателя', err);
                }
            } else if (taskObj.user_id === user?.id) {
                setCreator(user);
            }
        } catch (error) {
            console.error(error);
            showToast('error', 'Не удалось загрузить задание');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTask();
    }, [taskId]);

    const canManage = course && user && (
        course.creator_id === user.id || course.pivot?.role === 'teacher'
    );

    const handleDelete = async () => {
        try {
            await taskService.deleteTask(taskId);
            showToast('success', 'Задание удалено');
            navigate(-1);
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Ошибка удаления');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleSubmitFile = async () => {
        if (!submitFile) {
            showToast('error', 'Выберите файл');
            return;
        }
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('attachment', submitFile);
            await apiClient.post(`/task/${taskId}/submit`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('success', 'Работа отправлена');
            setShowSubmitModal(false);
            setSubmitFile(null);
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Ошибка отправки');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MainLayout>
        );
    }

    if (!task) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <p className="text-gray-400 text-xl">Задание не найдено</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="mt-4 text-purple-400 hover:text-purple-300 flex items-center gap-1 mx-auto"
                    >
                        <HiArrowLeft className="w-5 h-5" /> Назад
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                {/* Верхняя строка: назад, заголовок, кнопки */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(-1)} className="text-purple-400 hover:text-purple-300">
                            <HiArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-bold">{task.name}</h1>
                    </div>
                    {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition" title="Редактировать">
                                <HiPencil className="w-5 h-5" />
                            </button>
                            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition" title="Удалить">
                                <HiTrash className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Двухколоночный макет */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Левая колонка: описание и кнопка отправки */}
                    <div className="lg:col-span-2 space-y-6">
                        {task.description && (
                            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                                <p className="text-gray-300 whitespace-pre-wrap">{task.description}</p>
                            </div>
                        )}
                        {!canManage && (
                            <button onClick={() => setShowSubmitModal(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition w-full sm:w-auto">
                                Отправить работу
                            </button>
                        )}
                    </div>

                    {/* Правая колонка: детали + кнопки управления */}
                    <div className="space-y-4 lg:mt-0">
                        <div className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5">
                            {/* Создано */}
                            <div className="border-b border-white/10">
                                <div className="text-gray-400 mb-2">Создано:</div>
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center overflow-hidden">
                                        {creator?.avatar_url ? (
                                            <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <HiUserCircle className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">{creator?.name || 'Неизвестно'}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <HiClock className="w-3 h-3" />
                                            {formatDateTime(task.created_at)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Баллы */}
                            <div className="flex items-center justify-between py-3 border-b border-white/10">
                                <span className="text-gray-400">Баллы</span>
                                <span className="flex items-center gap-1 font-semibold">
                                    <HiStar className="w-4 h-4 text-yellow-400" />
                                    {task.scores ?? 0}
                                </span>
                            </div>

                            {/* Срок сдачи */}
                            <div className="flex items-center justify-between py-3 border-b border-white/10">
                                <span className="text-gray-400">Срок сдачи</span>
                                <span className="flex items-center gap-1 text-right">
                                    <HiCalendar className="w-4 h-4 text-gray-500" />
                                    {task.deadline ? formatDateTime(task.deadline) : '—'}
                                </span>
                            </div>

                            {/* Прикреплённый файл */}
                            {task.attachment_id && (
                                <div className="py-3">
                                    <div className="text-gray-400 mb-2">Прикреплённый файл</div>
                                    <a
                                        href={`https://aiditorium.ru/api/file/${task.attachment_id}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 break-all"
                                    >
                                        <HiPaperClip className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-sm">Скачать вложение</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Модалки */}
            {task && (
                <EditTaskModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        setShowEditModal(false);
                        fetchTask();
                    }}
                    task={task}
                />
            )}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Удаление задания"
                message="Вы уверены? Это действие необратимо."
                confirmText="Удалить"
            />

            {/* Модалка отправки работы */}
            {showSubmitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowSubmitModal(false)}>
                    <div className="bg-[#1A1A1C] rounded-2xl max-w-md w-full p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-white mb-4">Отправить работу</h2>
                        <input
                            type="file"
                            onChange={(e) => setSubmitFile(e.target.files[0])}
                            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                        />
                        {submitFile && (
                            <p className="text-sm text-gray-400 mt-2">Выбран: {submitFile.name}</p>
                        )}
                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={handleSubmitFile}
                                disabled={submitting}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold disabled:opacity-50"
                            >
                                {submitting ? 'Отправка...' : 'Отправить'}
                            </button>
                            <button
                                onClick={() => setShowSubmitModal(false)}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold"
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default TaskDetailPage;