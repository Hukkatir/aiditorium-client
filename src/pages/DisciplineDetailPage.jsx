import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { HiCalendar, HiClock, HiPencil, HiStar, HiTrash } from 'react-icons/hi2';
import EditDisciplineModal from '../components/disciplines/EditDisciplineModal';
import CreateTaskModal from '../components/tasks/CreateTaskModal';
import ConfirmModal from '../components/layout/ConfirmModal';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { courseService } from '../services/courseService';
import { disciplineService } from '../services/disciplineService';
import { taskService } from '../services/taskService';
import { buildCoursePath, buildDisciplinePath, buildTaskPath } from '../utils/routeUtils';

const DisciplineDetailPage = () => {
    const { courseIdOrSlug, disciplineIdOrSlug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [discipline, setDiscipline] = useState(null);
    const [course, setCourse] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [showEditDiscipline, setShowEditDiscipline] = useState(false);
    const [showDeleteDisciplineConfirm, setShowDeleteDisciplineConfirm] = useState(false);

    const syncCanonicalDisciplineUrl = (courseObj, disciplineObj) => {
        const courseRef = courseObj || { id: disciplineObj.course_id, slug: courseIdOrSlug };
        const canonicalPath = buildDisciplinePath(courseRef, disciplineObj);
        if (window.location.pathname !== canonicalPath) navigate(canonicalPath, { replace: true });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const disciplineData = await disciplineService.getDiscipline(courseIdOrSlug, disciplineIdOrSlug);
            const disciplineObj = disciplineData.discipline || disciplineData;
            setDiscipline(disciplineObj);
            const courseData = await courseService.getCourse(disciplineObj.course_id);
            const courseObj = courseData.course || courseData;
            setCourse(courseObj);
            syncCanonicalDisciplineUrl(courseObj, disciplineObj);
            try { const tasksData = await taskService.getTasks({ course_id: disciplineObj.course_id, discipline_id: disciplineObj.id, per_page: 100 }); setTasks(tasksData.data || []); } catch { setTasks([]); }
        } catch (error) {
            console.error(error);
            setDiscipline(null);
            setCourse(null);
            showToast('error', 'Не удалось загрузить данные дисциплины');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [courseIdOrSlug, disciplineIdOrSlug]);

    const canManage = discipline && user && (discipline.created_by === user.id || discipline.pivot?.role === 'teacher');
    const courseRef = course || { id: discipline?.course_id, slug: courseIdOrSlug };
    const handleDeleteDiscipline = async () => { if (!discipline) return; try { await disciplineService.deleteDiscipline(discipline.id); showToast('success', 'Дисциплина удалена'); navigate(buildCoursePath(courseRef)); } catch (error) { showToast('error', error.response?.data?.error || error.response?.data?.message || 'Ошибка удаления дисциплины'); } finally { setShowDeleteDisciplineConfirm(false); } };

    if (loading) return <MainLayout><div className="flex items-center justify-center h-full"><div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div></MainLayout>;
    if (!discipline) return <MainLayout><div className="text-center py-20"><p className="text-gray-400 text-xl">Дисциплина не найдена</p><button onClick={() => navigate('/courses')} className="mt-4 text-purple-400 hover:text-purple-300">← Назад</button></div></MainLayout>;

    return (<MainLayout><div className="max-w-6xl mx-auto"><button onClick={() => navigate(buildCoursePath(courseRef))} className="mb-4 text-purple-400 hover:text-purple-300 flex items-center gap-1">← Назад к курсу</button><div className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">{discipline.name}</h1><p className="text-gray-400 mt-1">{discipline.description}</p><div className="flex items-center gap-4 mt-2 text-sm text-gray-500"><span className="flex items-center gap-1"><HiClock className="w-4 h-4" />Часов: {discipline.hours || 0}</span></div></div>{canManage && <div className="flex gap-2"><button onClick={() => setShowEditDiscipline(true)} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg"><HiPencil className="w-5 h-5" /></button><button onClick={() => setShowDeleteDisciplineConfirm(true)} className="p-2 bg-red-600/20 hover:bg-red-600/30 rounded-lg"><HiTrash className="w-5 h-5 text-red-400" /></button></div>}</div><div className="flex items-center justify-between mb-6"><h2 className="text-2xl font-semibold">Задания</h2>{canManage && <button onClick={() => setShowCreateTask(true)} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition">+ Создать задание</button>}</div>{tasks.length === 0 ? <p className="text-gray-500">В этой дисциплине пока нет заданий</p> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{tasks.map((task) => <motion.div key={task.id} whileHover={{ y: -4 }} className="bg-white/[0.02] backdrop-blur border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500 transition-all" onClick={() => navigate(buildTaskPath(courseRef, discipline, task))}><h3 className="text-lg font-bold mb-2">{task.name}</h3><p className="text-gray-400 text-sm line-clamp-2 mb-3">{task.description}</p><div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">{task.scores !== undefined && <span className="flex items-center gap-1"><HiStar className="w-3 h-3 text-yellow-400" />{task.scores} баллов</span>}{task.deadline && <span className="flex items-center gap-1"><HiCalendar className="w-3 h-3" />Срок сдачи: {new Date(task.deadline).toLocaleDateString()}</span>}</div></motion.div>)}</div>}</div><EditDisciplineModal isOpen={showEditDiscipline} onClose={() => setShowEditDiscipline(false)} onSuccess={() => { setShowEditDiscipline(false); fetchData(); }} discipline={discipline} /><CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} onSuccess={() => { setShowCreateTask(false); fetchData(); }} courseId={discipline.course_id} disciplineId={discipline.id} /><ConfirmModal isOpen={showDeleteDisciplineConfirm} onClose={() => setShowDeleteDisciplineConfirm(false)} onConfirm={handleDeleteDiscipline} title="Удаление дисциплины" message={`Удалить дисциплину ${discipline.name}?`} confirmText="Удалить" /></MainLayout>);
};

export default DisciplineDetailPage;
