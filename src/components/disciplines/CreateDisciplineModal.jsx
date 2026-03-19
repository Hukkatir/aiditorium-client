import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';
import { disciplineService } from '../../services/disciplineService';
import { useToast } from '../../context/ToastContext';

// Функция транслитерации (можно вынести в utils)
const transliterate = (text) => {
    const ru = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ы': 'Y', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    return text.split('').map(c => ru[c] || c).join('');
};

const CreateDisciplineModal = ({ isOpen, onClose, onSuccess, courseId }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        hours: 0,
    });
    const [slugInput, setSlugInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const slugOutput = transliterate(slugInput);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const err = {};
        if (!formData.name.trim()) err.name = 'Название обязательно';
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
        try {
            const payload = {
                course_id: parseInt(courseId),
                name: formData.name,
                description: formData.description,
                hours: parseInt(formData.hours) || 0,
            };
            if (slugOutput) payload.slug = slugOutput; // добавляем slug, если введён

            await disciplineService.createDiscipline(payload);
            onSuccess();
            onClose();
            // сброс формы
            setFormData({ name: '', description: '', hours: 0 });
            setSlugInput('');
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.message || 'Ошибка создания дисциплины');
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
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Описание</label>
                            <textarea
                                name="description"
                                rows="3"
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        {/* Поле для ввода слага */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Слаг (URL)</label>
                            <input
                                type="text"
                                value={slugInput}
                                onChange={(e) => setSlugInput(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                placeholder="Например, modelirovanie"
                            />
                            {slugInput && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Транслитерация: <span className="text-purple-300">{slugOutput}</span>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Часы (число)</label>
                            <input
                                type="number"
                                name="hours"
                                value={formData.hours}
                                onChange={handleChange}
                                min="0"
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {loading ? 'Создание...' : 'Создать'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition"
                            >
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