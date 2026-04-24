import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiPaperClip, HiPlus, HiXMark } from 'react-icons/hi2';
import RichTextEditor from '../editor/RichTextEditor';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';

const mergeUniqueFiles = (previousFiles, nextFiles) => {
    const seen = new Set(previousFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
    const result = [...previousFiles];

    nextFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push(file);
        }
    });

    return result;
};

const CreateTaskModal = ({ isOpen, onClose, onSuccess, courseId, disciplineId }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        scores: '',
        deadline: ''
    });
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const selectedMaterialNames = useMemo(
        () => materials.map((file, index) => ({ id: `${file.name}-${file.size}-${index}`, name: file.name })),
        [materials]
    );

    const resetState = () => {
        setFormData({
            name: '',
            description: '',
            scores: '',
            deadline: ''
        });
        setMaterials([]);
        setErrors({});
    };

    const handleClose = () => {
        if (loading) {
            return;
        }

        resetState();
        onClose();
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));

        if (errors[name]) {
            setErrors((previous) => ({ ...previous, [name]: '' }));
        }
    };

    const handleMaterialsChange = (event) => {
        const nextFiles = Array.from(event.target.files || []);
        event.target.value = '';

        if (!nextFiles.length) {
            return;
        }

        setMaterials((previous) => mergeUniqueFiles(previous, nextFiles));
    };

    const handleRemoveMaterial = (targetIndex) => {
        setMaterials((previous) => previous.filter((_, index) => index !== targetIndex));
    };

    const validate = () => {
        const nextErrors = {};

        if (!formData.name.trim()) {
            nextErrors.name = 'Название задания обязательно';
        }

        return nextErrors;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const nextErrors = validate();
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setLoading(true);

        try {
            const form = new FormData();
            form.append('course_id', String(parseInt(courseId, 10)));
            form.append('discipline_id', String(parseInt(disciplineId, 10)));
            form.append('name', formData.name.trim());

            if (formData.description) {
                form.append('description', formData.description);
            }
            if (formData.scores) {
                form.append('scores', String(parseInt(formData.scores, 10)));
            }
            if (formData.deadline) {
                form.append('deadline', formData.deadline);
            }

            materials.forEach((file) => {
                form.append('attachments[]', file);
            });

            await taskService.createTask(form);
            showToast('success', 'Задание создано');
            resetState();
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            const firstValidationError = Object.values(error.response?.data?.errors || {})?.[0]?.[0];
            showToast('error', firstValidationError || error.response?.data?.message || 'Ошибка создания задания');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.98, opacity: 0 }}
                    className="mx-auto my-4 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-purple-500/12 bg-[radial-gradient(circle_at_top_right,_rgba(124,58,237,0.14),_transparent_30%),rgba(15,17,27,0.98)] p-5 shadow-[0_32px_120px_rgba(0,0,0,0.42)] md:p-6"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="mb-7 flex items-start justify-between gap-4">
                        <div className="max-w-2xl">
                            <h2 className="text-3xl font-semibold text-white">Создать задание</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-400">
                                Заполните название, описание и при необходимости добавьте материалы к заданию.
                                Файлы можно выбрать сразу несколько.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-2xl p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                        >
                            <HiXMark className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),180px,220px]">
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-300">
                                    Название <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Например, Практическая работа №1"
                                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                                {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name}</p>}
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-300">Баллы</label>
                                <input
                                    type="number"
                                    name="scores"
                                    value={formData.scores}
                                    onChange={handleChange}
                                    min="0"
                                    placeholder="100"
                                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-300">Дедлайн</label>
                                <input
                                    type="datetime-local"
                                    name="deadline"
                                    value={formData.deadline}
                                    onChange={handleChange}
                                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none transition focus:border-purple-500 [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <RichTextEditor
                            id="create-task-description"
                            label="Описание"
                            value={formData.description}
                            onChange={(nextValue) => setFormData((previous) => ({ ...previous, description: nextValue }))}
                            placeholder="Опишите задачу, критерии сдачи и дополнительные пояснения для студентов"
                            minHeightClassName="min-h-[220px]"
                        />

                        <section className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Материалы задания</h3>
                                    <p className="mt-2 text-sm text-slate-400">
                                        В списке ниже показываются только названия выбранных файлов.
                                    </p>
                                </div>

                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/15 px-4 py-2.5 text-sm font-medium text-purple-100 transition hover:bg-purple-500/22">
                                    <HiPlus className="h-4 w-4" />
                                    Добавить файлы
                                    <input type="file" multiple onChange={handleMaterialsChange} className="hidden" />
                                </label>
                            </div>

                            {selectedMaterialNames.length > 0 ? (
                                <div className="mt-4 space-y-2">
                                    {selectedMaterialNames.map((item, index) => (
                                        <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <HiPaperClip className="h-4 w-4 text-slate-400" />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveMaterial(index)}
                                                className="rounded-full p-0.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                                            >
                                                <HiXMark className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-3xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
                                    Материалы пока не выбраны.
                                </div>
                            )}
                        </section>

                        <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="rounded-2xl bg-white/[0.06] px-5 py-3 font-medium text-white transition hover:bg-white/[0.1]"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-2xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-500 disabled:opacity-50"
                            >
                                {loading ? 'Создаём...' : 'Создать задание'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateTaskModal;
