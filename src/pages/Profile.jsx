import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    HiUser,
    HiEnvelope,
    HiAcademicCap,
    HiArrowRightOnRectangle,
    HiPencilSquare,
    HiXMark,
    HiCamera,
    HiCheck,
    HiTrash
} from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/userService';

const Profile = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    const { user, logout, updateUser } = useAuth();
    const { showToast } = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [editForm, setEditForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        password_confirmation: ''
    });
    const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);

    // Синхронизация при изменении user
    useEffect(() => {
        setEditForm({
            name: user?.name || '',
            email: user?.email || '',
            password: '',
            password_confirmation: ''
        });
        setAvatarPreview(user?.avatar_url || null);
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleLogout = async () => {
        await logout();
        navigate('/auth');
    };

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleAvatarChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        // Превью
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);

        setUploadingAvatar(true);
        try {
            const data = await userService.uploadAvatar(user.id, file);
            console.log('Avatar upload response:', data);

            if (data.status === 'success') {
                // В ответе есть полный объект user (с загруженным avatarFile)
                if (data.user) {
                    updateUser(data.user);
                } else if (data.avatar_url) {
                    // Если по какой-то причине user нет, используем avatar_url
                    updateUser({ ...user, avatar_url: data.avatar_url });
                }
                showToast('success', 'Аватар загружен');
            } else {
                showToast('error', data.message || 'Ошибка загрузки аватара');
                setAvatarPreview(user?.avatar_url || null);
            }
        } catch (err) {
            console.error(err);
            showToast('error', err.response?.data?.message || 'Ошибка загрузки аватара');
            setAvatarPreview(user?.avatar_url || null);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleAvatarDelete = async () => {
        if (!user?.id) return;

        setUploadingAvatar(true);
        try {
            const data = await userService.deleteAvatar(user.id);
            if (data.status === 'success') {
                updateUser({ ...user, avatar_url: null });
                setAvatarPreview(null);
                showToast('success', 'Аватар удалён');
            } else {
                showToast('error', data.message || 'Ошибка удаления аватара');
            }
        } catch (err) {
            console.error(err);
            showToast('error', 'Ошибка удаления аватара');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!user?.id) return;

        setSaving(true);
        const updateData = {
            name: editForm.name,
            email: editForm.email,
        };
        if (editForm.password) {
            updateData.password = editForm.password;
            updateData.password_confirmation = editForm.password_confirmation;
        }

        try {
            const data = await userService.updateProfile(user.id, updateData);
            console.log('Profile update response:', data);
            if (data.status === 'success' && data.user) {
                updateUser(data.user);
                showToast('success', 'Профиль обновлён');
                setIsEditing(false);
            } else {
                showToast('error', data.message || 'Ошибка обновления профиля');
            }
        } catch (err) {
            console.error(err);
            showToast('error', err.response?.data?.message || 'Ошибка обновления');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditForm({
            name: user?.name || '',
            email: user?.email || '',
            password: '',
            password_confirmation: ''
        });
        setAvatarPreview(user?.avatar_url || null);
        setIsEditing(false);
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
                <div className="text-white">Загрузка...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white">
            {/* Фон (как у тебя) */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#7c3aed10_0%,transparent_50%)]" />
            </div>

            {/* Навигация */}
            <nav className="relative z-10 border-b border-white/10 bg-black/20 backdrop-blur-lg">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                <HiAcademicCap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">AIditorium</span>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                        >
                            <HiArrowRightOnRectangle className="w-5 h-5" />
                            <span>Выйти</span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Основной контент */}
            <div className="relative z-10 container mx-auto px-4 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-4xl mx-auto"
                >
                    {/* Заголовок и кнопки */}
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                            Личный кабинет
                        </h1>
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
                            >
                                <HiPencilSquare className="w-5 h-5" />
                                <span>Редактировать</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    <HiCheck className="w-5 h-5" />
                                    <span>{saving ? 'Сохранение...' : 'Сохранить'}</span>
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                                >
                                    <HiXMark className="w-5 h-5" />
                                    <span>Отмена</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Карточка профиля */}
                    <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[32px] p-8 border border-white/10">
                        <div className="flex flex-col md:flex-row items-start gap-8">
                            {/* Аватар */}
                            <div className="relative group">
                                <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center overflow-hidden shadow-xl shadow-purple-500/20">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-4xl font-bold text-white">
                      {user.name?.charAt(0) || 'U'}
                    </span>
                                    )}

                                    {/* Кнопки управления */}
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={handleAvatarClick}
                                            disabled={uploadingAvatar}
                                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                                            title="Загрузить фото"
                                        >
                                            <HiCamera className="w-5 h-5 text-white" />
                                        </button>
                                        {user.avatar_url && (
                                            <button
                                                onClick={handleAvatarDelete}
                                                disabled={uploadingAvatar}
                                                className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-full transition-colors"
                                                title="Удалить фото"
                                            >
                                                <HiTrash className="w-5 h-5 text-white" />
                                            </button>
                                        )}
                                    </div>

                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleAvatarChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            {/* Информация о пользователе */}
                            <div className="flex-1 w-full">
                                {!isEditing ? (
                                    // Просмотр
                                    <>
                                        <h2 className="text-3xl font-bold text-white mb-2">{user.name}</h2>
                                        <div className="flex items-center gap-2 text-gray-400 mb-4">
                                            <HiEnvelope className="w-5 h-5" />
                                            <span>{user.email}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-gray-500">
                                            <span>ID: {user.id}</span>
                                            <span>•</span>
                                            <span>Зарегистрирован: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    </>
                                ) : (
                                    // Редактирование
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-400 mb-2">Имя</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={editForm.name}
                                                onChange={handleInputChange}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-400 mb-2">Email</label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={editForm.email}
                                                onChange={handleInputChange}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Статистика */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 bg-white/5 rounded-2xl">
                                    <div className="text-2xl font-bold text-purple-400">
                                        {user.courses_count || 0}
                                    </div>
                                    <div className="text-xs text-gray-400">Курсов</div>
                                </div>
                                <div className="text-center p-4 bg-white/5 rounded-2xl">
                                    <div className="text-2xl font-bold text-blue-400">
                                        {user.assignments_count || 0}
                                    </div>ы
                                    <div className="text-xs text-gray-400">Заданий</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Profile;