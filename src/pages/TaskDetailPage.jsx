// src/pages/TaskDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { taskService } from '../services/taskService';
import { courseService } from '../services/courseService'; // для проверки прав
import MainLayout from '../components/layout/MainLayout';
import EditTaskModal from '../components/tasks/EditTaskModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import { HiCalendar, HiClock, HiStar, HiPaperClip, HiPencil, HiTrash } from 'react-icons/hi2';
import apiClient from '../services/apiClient'; // для отправки файла

const TaskDetailPage = () => {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false); // для студента
    const [submitFile, setSubmitFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [course, setCourse] = useState(null); // для проверки прав

    const fetchTask = async () => {
        try {
            const data = await taskService.getTask(taskId);
            const taskObj = data.task || data;
            setTask(taskObj);

            // Загружаем курс, чтобы узнать роль текущего пользователя
            if (taskObj.course_id) {
                const courseData = await courseService.getCourse(taskObj.course_id);
                setCourse(courseData.course || courseData);
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

    // Проверка прав на редактирование/удаление (создатель курса или учитель)
    const canManage = course && user && (
        course.creator_id === user.id || course.pivot?.role === 'teacher'
    );

    const handleDelete = async () => {
        try {
            await taskService.deleteTask(taskId);
            showToast('success', 'Задание удалено');
            navigate(-1); // назад
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
            // Предполагаем эндпоинт POST /api/task/{id}/submit
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
            <div className="max-w-4xl mx-auto">
                {/* Кнопка назад */}
                <button
                    onClick={() => navigate(-1)}
                    className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                    ← Назад
                </button>

                {/* Заголовок и действия */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold">{task.name}</h1>
                    {canManage && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
                                title="Редактировать"
                            >
                                <HiPencil className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition"
                                title="Удалить"
                            >
                                <HiTrash className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Описание */}
                {task.description && (
                    <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                        <p className="text-gray-300 whitespace-pre-wrap">{task.description}</p>
                    </div>
                )}

                {/* Информация о задании */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="text-sm text-gray-400 mb-1">Баллы</div>
                        <div className="flex items-center gap-1 text-xl font-semibold">
                            <HiStar className="w-5 h-5 text-yellow-400" />
                            {task.scores ?? 0}
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="text-sm text-gray-400 mb-1">Срок сдачи</div>
                        <div className="flex items-center gap-1 text-lg">
                            <HiCalendar className="w-5 h-5" />
                            {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                        </div>
                    </div>
                    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4">
                        <div className="text-sm text-gray-400 mb-1">Создано</div>
                        <div className="flex items-center gap-1 text-lg">
                            <HiClock className="w-5 h-5" />
                            {task.created_at ? new Date(task.created_at).toLocaleDateString() : '—'}
                        </div>
                    </div>
                </div>

                {/* Вложение (если есть) */}
                {task.attachment_id && (
                    <div className="mb-6 p-4 bg-white/[0.02] border border-white/10 rounded-xl">
                        <div className="text-sm text-gray-400 mb-2">Прикреплённый файл</div>
                        <a
                            href={`https://aiditorium.ru/api/file/${task.attachment_id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-purple-400 hover:text-purple-300"
                        >
                            <HiPaperClip className="w-5 h-5" />
                            Скачать вложение
                        </a>
                    </div>
                )}

                {/* Для студента – кнопка отправки работы */}
                {!canManage && (
                    <div className="mt-8">
                        <button
                            onClick={() => setShowSubmitModal(true)}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition"
                        >
                            Отправить работу
                        </button>
                    </div>
                )}
            </div>

            {/* Модалка редактирования */}
            {task && (
                <EditTaskModal
                    isOpen={showEditModal}
                    onClose={() => setShowEditModal(false)}
                    onSuccess={() => {
                        setShowEditModal(false);
                        fetchTask(); // обновить задание
                    }}
                    task={task}
                />
            )}

            {/* Модалка подтверждения удаления */}
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Удаление задания"
                message="Вы уверены? Это действие необратимо."
                confirmText="Удалить"
            />

            {/* Модалка отправки работы (для студента) */}
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