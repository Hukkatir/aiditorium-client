import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HiPaperClip, HiPlus, HiXMark } from 'react-icons/hi2';
import RichTextEditor from '../editor/RichTextEditor';
import FileTileGrid from '../files/FileTileGrid';
import { taskService } from '../../services/taskService';
import { useToast } from '../../context/ToastContext';
import { TASK_MATERIALS_MAX_TOTAL_BYTES, formatFileSize, getFilesTotalSize, getTaskMaterials } from '../../utils/fileUtils';

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

const getDateTimeLocalValue = (date = new Date()) => {
    const prepared = new Date(date);
    prepared.setSeconds(0, 0);
    const timezoneOffset = prepared.getTimezoneOffset() * 60_000;

    return new Date(prepared.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const mapServerErrors = (serverErrors = {}) => ({
    name: serverErrors.name?.[0] || '',
    scores: serverErrors.scores?.[0] || '',
    deadline: serverErrors.deadline?.[0] || '',
    description: serverErrors.description?.[0] || '',
    attachments: serverErrors.attachments?.[0] || ''
});

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

    const initialDeadlineValue = useMemo(
        () => (task?.deadline ? getDateTimeLocalValue(new Date(task.deadline)) : ''),
        [task?.deadline]
    );

    const minDeadlineValue = useMemo(() => {
        const nowValue = getDateTimeLocalValue();

        if (!initialDeadlineValue) {
            return nowValue;
        }

        return new Date(initialDeadlineValue).getTime() < new Date(nowValue).getTime()
            ? initialDeadlineValue
            : nowValue;
    }, [initialDeadlineValue]);

    useEffect(() => {
        if (!task) {
            return;
        }

        setFormData({
            name: task.name || '',
            description: task.description || '',
            scores: task.scores ?? '',
            deadline: initialDeadlineValue
        });
        setNewMaterials([]);
        setRemovedAttachmentIds([]);
        setErrors({});
    }, [initialDeadlineValue, task]);

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
        const trimmedName = formData.name.trim();
        const trimmedScores = String(formData.scores || '').trim();
        const trimmedDeadline = String(formData.deadline || '').trim();
        const materialsTotalSize = getFilesTotalSize(existingMaterials) + getFilesTotalSize(newMaterials);

        if (!trimmedName) {
            nextErrors.name = 'Введите название задания.';
        }

        if (trimmedScores) {
            if (!/^\d+$/.test(trimmedScores)) {
                nextErrors.scores = 'Баллы должны быть целым неотрицательным числом.';
            } else if (Number(trimmedScores) < 0) {
                nextErrors.scores = 'Баллы не могут быть отрицательными.';
            }
        }

        if (trimmedDeadline) {
            const deadlineTime = new Date(trimmedDeadline).getTime();
            if (Number.isNaN(deadlineTime)) {
                nextErrors.deadline = 'Укажите корректную дату срока сдачи.';
            } else if (trimmedDeadline !== initialDeadlineValue && deadlineTime < Date.now() - 60_000) {
                nextErrors.deadline = 'Срок сдачи не может быть в прошлом.';
            }
        }

        if (materialsTotalSize > TASK_MATERIALS_MAX_TOTAL_BYTES) {
            nextErrors.attachments = `Общий размер материалов не должен превышать ${formatFileSize(TASK_MATERIALS_MAX_TOTAL_BYTES)}. После сохранения будет ${formatFileSize(materialsTotalSize)}.`;
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
            const payload = new FormData();
            payload.append('name', formData.name.trim());

            if (formData.description.trim()) {
                payload.append('description', formData.description.trim());
            }
            if (String(formData.scores).trim()) {
                payload.append('scores', String(parseInt(formData.scores, 10)));
            }
            if (formData.deadline) {
                payload.append('deadline', formData.deadline);
            }

            removedAttachmentIds.forEach((fileId) => {
                payload.append('removed_attachment_ids[]', String(fileId));
            });

            await taskService.updateTask(task.id, payload);

            if (newMaterials.length > 0) {
                await taskService.uploadTaskMaterials(task.id, newMaterials);
            }

            showToast('success', 'Задание обновлено');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);

            if (error.response?.data?.errors) {
                setErrors(mapServerErrors(error.response.data.errors));
            }

            const firstValidationError = Object.values(error.response?.data?.errors || {})?.[0]?.[0];
            showToast('error', firstValidationError || error.response?.data?.message || 'Не удалось обновить задание');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !task) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 py-4 backdrop-blur-sm"
                onClick={handleClose}
            >
                <div className="w-full max-w-5xl">
                    <motion.div
                        initial={{ scale: 0.98, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.98, opacity: 0 }}
                        className="flex h-[min(860px,calc(100vh-32px))] w-full flex-col overflow-hidden rounded-2xl border border-purple-500/20 bg-[#17141F] p-4 shadow-2xl md:p-5"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex shrink-0 items-start justify-between gap-4 border-b border-white/10 pb-4">
                            <div className="max-w-2xl">
                                <h2 className="text-2xl font-bold text-white">Редактировать задание</h2>
                                <p className="mt-2 text-sm text-gray-400">
                                    Обновите описание, баллы, срок сдачи и материалы задания.
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

                        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
                            <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr),170px,240px]">
                                <div className="rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5">
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

                                <div className="rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5">
                                    <label className="mb-2 block text-sm font-medium text-gray-400">Баллы</label>
                                    <input
                                        type="number"
                                        name="scores"
                                        value={formData.scores}
                                        onChange={handleChange}
                                        min="0"
                                        step="1"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                    />
                                    {errors.scores && <p className="mt-2 text-sm text-red-400">{errors.scores}</p>}
                                </div>

                                <div className="rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5">
                                    <label className="mb-2 block text-sm font-medium text-gray-400">Срок сдачи</label>
                                    <input
                                        type="datetime-local"
                                        name="deadline"
                                        value={formData.deadline}
                                        onChange={handleChange}
                                        min={minDeadlineValue}
                                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500 [color-scheme:dark]"
                                    />
                                    {errors.deadline && <p className="mt-2 text-sm text-red-400">{errors.deadline}</p>}
                                </div>
                            </div>

                            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr),300px]">
                                <section className="flex min-h-0 flex-col rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5 md:p-4">
                                    <RichTextEditor
                                        id="edit-task-description"
                                        label="Описание"
                                        value={formData.description}
                                        onChange={(nextValue) => setFormData((previous) => ({ ...previous, description: nextValue }))}
                                        placeholder="Опишите задачу, критерии и ожидаемый формат сдачи"
                                        error={errors.description}
                                        minHeightClassName="min-h-0 flex-1"
                                        editorClassName="overflow-y-auto"
                                    />
                                </section>

                                <aside className="flex min-h-0 flex-col gap-4">
                                    <section className="flex min-h-0 flex-col rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5 md:p-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-white">Текущие материалы</h3>
                                            <p className="mt-1 text-sm text-gray-400">
                                                Уберите файл из списка, если он больше не нужен.
                                            </p>
                                        </div>

                                        <div className="mt-3 max-h-32 overflow-y-auto pr-1">
                                            <FileTileGrid
                                                files={existingMaterials}
                                                emptyMessage="Сейчас у задания нет материалов."
                                                onRemove={handleRemoveExistingMaterial}
                                            />
                                        </div>
                                    </section>

                                    <section className="flex min-h-0 flex-col rounded-2xl border border-purple-500/10 bg-white/[0.03] p-3.5 md:p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-semibold text-white">Новые материалы</h3>
                                                <p className="mt-1 text-sm text-gray-400">
                                                    Можно выбрать один файл или сразу несколько.
                                                </p>
                                            </div>

                                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-purple-500/20">
                                                <HiPlus className="h-4 w-4" />
                                                Добавить
                                                <input type="file" multiple onChange={handleNewMaterialsChange} className="hidden" />
                                            </label>
                                        </div>

                                        {newMaterials.length > 0 ? (
                                            <div className="mt-3 max-h-32 space-y-2 overflow-y-auto pr-1">
                                                {newMaterials.map((file, index) => (
                                                    <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <HiPaperClip className="h-4 w-4 shrink-0 text-gray-400" />
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
                                            <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-gray-500">
                                                Новые материалы пока не выбраны.
                                            </div>
                                        )}
                                        {errors.attachments && <p className="mt-2 text-sm text-red-400">{errors.attachments}</p>}
                                    </section>
                                </aside>
                            </div>

                            <div className="flex shrink-0 flex-wrap justify-end gap-3 pt-1">
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
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default EditTaskModal;
