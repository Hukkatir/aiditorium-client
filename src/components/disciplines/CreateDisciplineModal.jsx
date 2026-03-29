import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';
import { disciplineService } from '../../services/disciplineService';
import { useToast } from '../../context/ToastContext';
import { getSlugValidationError, slugifyPreview } from '../../utils/slugUtils';

const CreateDisciplineModal = ({ isOpen, onClose, onSuccess, courseId }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        hours: 0,
        slug: ''
    });
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const slugPreview = useMemo(() => slugifyPreview(formData.slug), [formData.slug]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const err = {};
        if (!formData.name.trim()) err.name = 'Название обязательно';
        const slugError = getSlugValidationError(formData.slug);
        if (slugError) err.slug = slugError;
        return err;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }

        setLoading(true);
        setErrors({});
        try {
            const payload = {
                course_id: parseInt(courseId, 10),
                name: formData.name,
                description: formData.description,
                hours: parseInt(formData.hours, 10) || 0
            };
            if (formData.slug.trim()) payload.slug = formData.slug;
            await disciplineService.createDiscipline(payload);
            onSuccess();
            onClose();
            setFormData({ name: '', description: '', hours: 0, slug: '' });
        } catch (error) {
            const message = error.response?.data?.error || error.response?.data?.message || 'Ошибка создания дисциплины';
            if (message.includes('slug')) {
                setErrors((prev) => ({ ...prev, slug: message }));
            }
            showToast('error', message);
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
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#1A1A1C] rounded-2xl max-w-md w-full p-6 border border-white/10"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-white">Создать дисциплину</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <HiXMark className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Название</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" />
                            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Описание</label>
                            <textarea name="description" rows="3" value={formData.description} onChange={handleChange} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Часы</label>
                            <input type="number" name="hours" value={formData.hours} onChange={handleChange} min="0" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Slug</label>
                            <input type="text" name="slug" value={formData.slug} onChange={handleChange} placeholder="Например: ремонт кухни" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none" />
                            <p className="text-xs text-gray-500 mt-2">Итоговый slug: <span className="text-gray-300">{slugPreview || '—'}</span></p>
                            {errors.slug && <p className="text-red-400 text-sm mt-1">{errors.slug}</p>}
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button type="submit" disabled={loading} className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold transition disabled:opacity-50">
                                {loading ? 'Создание...' : 'Создать'}
                            </button>
                            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition">
                                Отмена
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CreateDisciplineModal;
