import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
    HiCalendar,
    HiClock,
    HiPaperClip,
    HiPencil,
    HiStar,
    HiTrash,
    HiUserCircle
} from 'react-icons/hi2';
import apiClient from '../services/apiClient';
import { buildDisciplinePath } from '../utils/routeUtils';

const formatDateTime = (dateString) => {
    if (!dateString) return 'вЂ”';
    return new Date(dateString).toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const TaskDetailPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug, taskNumber } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [task, setTask] = useState(null);
    const [creator, setCreator] = useState(null);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [submitFile, setSubmitFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const disciplinePath = buildDisciplinePath(
        course || { id: task?.course_id, slug: courseIdOrSlug },
        { id: task?.discipline_id, slug: disciplineIdOrSlug }
    );

    const fetchTask = async () => {
        setLoading(true);
        try {
            const data = await taskService.getTask(courseIdOrSlug, disciplineIdOrSlug, taskNumber);
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
                } catch {
                    setCreator(null);
                }
            } else if (taskObj.user_id === user?.id) {
                setCreator(user);
            } else {
                setCreator(null);
            }
        } catch (error) {
            console.error(error);
            setTask(null);
            showToast('error', 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р·Р°РґР°РЅРёРµ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTask();
    }, [courseIdOrSlug, disciplineIdOrSlug, taskNumber]);

    const canManage = course && user && (
        course.creator_id === user.id || course.pivot?.role === 'teacher'
    );

    const handleDelete = async () => {
        if (!task) return;
        try {
            await taskService.deleteTask(task.id);
            showToast('success', 'Р—Р°РґР°РЅРёРµ СѓРґР°Р»РµРЅРѕ');
            navigate(disciplinePath);
        } catch (error) {
            showToast('error', error.response?.data?.message || 'РћС€РёР±РєР° СѓРґР°Р»РµРЅРёСЏ');
        } finally {
            setShowDeleteConfirm(false);
        }
    };

    const handleSubmitFile = async () => {
        if (!submitFile || !task) {
            showToast('error', 'Р’С‹Р±РµСЂРёС‚Рµ С„Р°Р№Р»');
            return;
        }

        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('attachment', submitFile);
            await apiClient.post(`/task/${task.id}/submit`, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            showToast('success', 'Р Р°Р±РѕС‚Р° РѕС‚РїСЂР°РІР»РµРЅР°');
            setShowSubmitModal(false);
            setSubmitFile(null);
        } catch (error) {
            showToast('error', error.response?.data?.message || 'РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё');
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
                    <p className="text-gray-400 text-xl">Р—Р°РґР°РЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ</p>
                    <button onClick={() => navigate(disciplinePath)} className="mt-4 text-purple-400 hover:text-purple-300 flex items-center gap-1 mx-auto">
                        <HiArrowLeft className="w-5 h-5" /> РќР°Р·Р°Рґ
                    </button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate(disciplinePath)} className="text-purple-400 hover:text-purple-300">
                            <HiArrowLeft className="w-6 h-6" />
                        </button>
                        <h1 className="text-3xl font-bold">{task.name}</h1>
                    </div>
                    {canManage && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowEditModal(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition">
                                <HiPencil className="w-5 h-5" />
                            </button>
                            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg transition">
                                <HiTrash className="w-5 h-5 text-red-400" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        {task.description && (
                            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5">
                                <p className="text-gray-300 whitespace-pre-wrap">{task.description}</p>
                            </div>
                        )}
                        {!canManage && (
                            <button onClick={() => setShowSubmitModal(true)} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-medium transition w-full sm:w-auto">
                                РћС‚РїСЂР°РІРёС‚СЊ СЂР°Р±РѕС‚Сѓ
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5">
                            <div className="border-b border-white/10">
                                <div className="text-gray-400 mb-2">РЎРѕР·РґР°РЅРѕ:</div>
                                <div className="mb-3 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center overflow-hidden">
                                        {creator?.avatar_url ? (
                                            <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <HiUserCircle className="w-6 h-6 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">{creator?.name || 'РќРµРёР·РІРµСЃС‚РЅРѕ'}</p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <HiClock className="w-3 h-3" />
                                            {formatDateTime(task.created_at)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-white/10">
                                <span className="text-gray-400">Р‘Р°Р»Р»С‹</span>
                                <span className="flex items-center gap-1 font-semibold">
                                    <HiStar className="w-4 h-4 text-yellow-400" />
                                    {task.scores ?? 0}
                                </span>
                            </div>

                            <div className="flex items-center justify-between py-3 border-b border-white/10">
                                <span className="text-gray-400">РЎСЂРѕРє СЃРґР°С‡Рё</span>
                                <span className="flex items-center gap-1 text-right">
                                    <HiCalendar className="w-4 h-4 text-gray-500" />
                                    {task.deadline ? formatDateTime(task.deadline) : 'вЂ”'}
                                </span>
                            </div>

                            {task.attachment_id && (
                                <div className="py-3">
                                    <div className="text-gray-400 mb-2">РџСЂРёРєСЂРµРїР»С‘РЅРЅС‹Р№ С„Р°Р№Р»</div>
                                    <a
                                        href={`https://aiditorium.ru/api/file/${task.attachment_id}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-purple-400 hover:text-purple-300 break-all"
                                    >
                                        <HiPaperClip className="w-4 h-4 flex-shrink-0" />
                                        <span className="text-sm">РЎРєР°С‡Р°С‚СЊ РІР»РѕР¶РµРЅРёРµ</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

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
                title="РЈРґР°Р»РµРЅРёРµ Р·Р°РґР°РЅРёСЏ"
                message="Р’С‹ СѓРІРµСЂРµРЅС‹? Р­С‚Рѕ РґРµР№СЃС‚РІРёРµ РЅРµРѕР±СЂР°С‚РёРјРѕ."
                confirmText="РЈРґР°Р»РёС‚СЊ"
            />

            {showSubmitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowSubmitModal(false)}>
                    <div className="bg-[#1A1A1C] rounded-2xl max-w-md w-full p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <h2 className="text-2xl font-bold text-white mb-4">РћС‚РїСЂР°РІРёС‚СЊ СЂР°Р±РѕС‚Сѓ</h2>
                        <input
                            type="file"
                            onChange={(e) => setSubmitFile(e.target.files[0])}
                            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                        />
                        {submitFile && <p className="text-sm text-gray-400 mt-2">Р’С‹Р±СЂР°РЅ: {submitFile.name}</p>}
                        <div className="flex gap-4 mt-6">
                            <button onClick={handleSubmitFile} disabled={submitting} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold disabled:opacity-50">
                                {submitting ? 'РћС‚РїСЂР°РІРєР°...' : 'РћС‚РїСЂР°РІРёС‚СЊ'}
                            </button>
                            <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold">
                                РћС‚РјРµРЅР°
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
};

export default TaskDetailPage;
