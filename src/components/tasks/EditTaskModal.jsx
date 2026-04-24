import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiPaperClip, HiPlus, HiXMark } from 'react-icons/hi2';
import RichTextEditor from '../editor/RichTextEditor';
import FileTileGrid from '../files/FileTileGrid';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { getTaskMaterials } from '../../utils/fileUtils';

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

const EditTaskModal = ({ isOpen, onClose, onSuccess, task }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        scores: '',
        deadline: ''
    });
    const [newMaterials, setNewMaterials] = useState([]);
    const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!task) {
            return;
        }

        const deadline = task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : '';

        setFormData({
            name: task.name || '',
            description: task.description || '',
            scores: task.scores || '',
            deadline
        });
        setNewMaterials([]);
        setRemovedAttachmentIds([]);
        setErrors({});
    }, [task]);

    const existingMaterials = useMemo(
        () => getTaskMaterials(task).filter((file) => !removedAttachmentIds.includes(Number(file.id))),
        [removedAttachmentIds, task]
    );

    const handleClose = () => {
        if (!loading) {
            onClose();
        }
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormData((previous) => ({ ...previous, [name]: value }));

        if (errors[name]) {
            setErrors((previous) => ({ ...previous, [name]: '' }));
        }
    };

    const handleNewMaterialsChange = (event) => {
        const nextFiles = Array.from(event.target.files || []);
        event.target.value = '';

        if (!nextFiles.length) {
            return;
        }

        setNewMaterials((previous) => mergeUniqueFiles(previous, nextFiles));
    };

    const handleRemoveNewMaterial = (targetIndex) => {
        setNewMaterials((previous) => previous.filter((_, index) => index !== targetIndex));
    };

    const handleRemoveExistingMaterial = (file) => {
        setRemovedAttachmentIds((previous) => [...new Set([...previous, Number(file.id)])]);
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

            newMaterials.forEach((file) => {
                form.append('attachments[]', file);
            });

            removedAttachmentIds.forEach((fileId) => {
                form.append('removed_attachment_ids[]', String(fileId));
            });

            await taskService.updateTask(task.id, form);
            showToast('success', 'Задание обновлено');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            const firstValidationError = Object.values(error.response?.data?.errors || {})?.[0]?.[0];
            showToast('error', firstValidationError || error.response?.data?.message || 'Ошибка обновления задания');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !task) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.98, opacity: 0 }}
                    className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1A1A1C] p-5 shadow-2xl md:p-6"
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="mb-6 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="max-w-2xl">
                            <h2 className="text-2xl font-bold text-white md:text-3xl">Редактировать задание</h2>
                            <p className="mt-2 text-sm text-gray-400">
                                Обновите описание, баллы, дедлайн и материалы задания.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="rounded-xl p-2 text-gray-400 transition hover:bg-white/5 hover:text-white"
                        >
                            <HiXMark className="h-6 w-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),170px,210px]">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <label className="mb-2 block text-sm font-medium text-gray-400">
                                    Название <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                                {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name}</p>}
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <label className="mb-2 block text-sm font-medium text-gray-400">Баллы</label>
                                <input
                                    type="number"
                                    name="scores"
                                    value={formData.scores}
                                    onChange={handleChange}
                                    min="0"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                />
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <label className="mb-2 block text-sm font-medium text-gray-400">Дедлайн</label>
                                <input
                                    type="datetime-local"
                                    name="deadline"
                                    value={formData.deadline}
                                    onChange={handleChange}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500 [color-scheme:dark]"
                                />
                            </div>
                        </div>

                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
                            <RichTextEditor
                                id="edit-task-description"
                                label="Описание"
                                value={formData.description}
                                onChange={(nextValue) => setFormData((previous) => ({ ...previous, description: nextValue }))}
                                placeholder="Опишите задачу, критерии и ожидаемый формат сдачи"
                                minHeightClassName="min-h-[220px]"
                            />
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Текущие материалы</h3>
                                <p className="mt-2 text-sm text-gray-400">
                                    Если файл больше не нужен, уберите его из списка.
                                </p>
                            </div>

                            <div className="mt-4">
                                <FileTileGrid
                                    files={existingMaterials}
                                    emptyMessage="Сейчас у задания нет материалов."
                                    onRemove={handleRemoveExistingMaterial}
                                />
                            </div>
                        </section>

                        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Добавить новые материалы</h3>
                                    <p className="mt-2 text-sm text-gray-400">
                                        После сохранения новые файлы сразу появятся у студентов.
                                    </p>
                                </div>

                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500/20">
                                    <HiPlus className="h-4 w-4" />
                                    Выбрать файлы
                                    <input type="file" multiple onChange={handleNewMaterialsChange} className="hidden" />
                                </label>
                            </div>

                            {newMaterials.length > 0 ? (
                                <div className="mt-4 space-y-2">
                                    {newMaterials.map((file, index) => (
                                        <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <HiPaperClip className="h-4 w-4 text-gray-400" />
                                                <span className="truncate">{file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveNewMaterial(index)}
                                                className="rounded-full p-0.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
                                            >
                                                <HiXMark className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500">
                                    Новые материалы пока не выбраны.
                                </div>
                            )}
                        </section>

                        <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="rounded-xl bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15"
                            >
                                Отмена
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-xl bg-purple-600 px-5 py-3 font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                            >
                                {loading ? 'Сохраняем...' : 'Сохранить изменения'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default EditTaskModal;
