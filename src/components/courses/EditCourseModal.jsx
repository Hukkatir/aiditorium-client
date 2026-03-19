import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';
import { courseService } from '../../services/courseService';
import { useToast } from '../../context/ToastContext';

const transliterate = (text) => {
    const ru = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ы': 'Y', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
    };
    return text.split('').map(c => ru[c] || c).join('');
};

const EditCourseModal = ({ isOpen, onClose, course, onSuccess }) => {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
    });
    const [slugInput, setSlugInput] = useState('');
    const [backgroundFile, setBackgroundFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (course) {
            setFormData({
                name: course.name || '',
                description: course.description || '',
                status: course.status || 'active',
            });
            setSlugInput(course.slug || '');
            if (course.background_logo_url) setPreview(course.background_logo_url);
        }
    }, [course]);

    const slugOutput = transliterate(slugInput);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setBackgroundFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const form = new FormData();
            form.append('name', formData.name);
            form.append('description', formData.description);
            form.append('status', formData.status);
            if (slugOutput) form.append('slug', slugOutput);
            if (backgroundFile) form.append('background_logo', backgroundFile);

            // PUT запрос с multipart/form-data
            await courseService.updateCourse(course.id, form);
            showToast('success', 'Курс обновлён');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.message || 'Ошибка обновления');
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
                        <h2 className="text-2xl font-bold text-white">Редактировать курс</h2>
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
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Описание</label>
                            <textarea
                                name="description"
                                rows="3"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Слаг (URL)</label>
                            <input
                                type="text"
                                value={slugInput}
                                onChange={(e) => setSlugInput(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            />
                            {slugInput && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Транслитерация: <span className="text-purple-300">{slugOutput}</span>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Статус</label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                            >
                                <option value="active">Активен</option>
                                <option value="archived">Архивирован</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Фоновое изображение</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                            />
                            {preview && (
                                <img src={preview} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-xl" />
                            )}
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                {loading ? 'Сохранение...' : 'Сохранить'}
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

export default EditCourseModal;