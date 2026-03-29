import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    HiUser,
    HiPencilSquare,
    HiXMark,
    HiCamera,
    HiCheck,
    HiTrash
} from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userService } from '../services/userService';
import MainLayout from '../components/layout/MainLayout';
import AvatarCropModal from '../components/profile/AvatarCropModal';

const ALLOWED_AVATAR_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
]);
const ALLOWED_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

const MAX_AVATAR_SIZE_BYTES = 3 * 1024 * 1024;

const getAvatarErrorMessage = (error) =>
    error.response?.data?.errors?.avatar?.[0]
    || error.response?.data?.message
    || 'Ошибка загрузки аватара';

const isSupportedAvatarFile = (file) => {
    const fileType = String(file?.type || '').toLowerCase();
    const fileExtension = String(file?.name || '')
        .split('.')
        .pop()
        ?.toLowerCase() || '';

    if (ALLOWED_AVATAR_TYPES.has(fileType)) {
        return true;
    }

    return ALLOWED_AVATAR_EXTENSIONS.has(fileExtension);
};

const Profile = () => {
    const fileInputRef = useRef(null);
    const { user, updateUser } = useAuth();
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
    const [avatarError, setAvatarError] = useState('');
    const [avatarCropSource, setAvatarCropSource] = useState(null);

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

    useEffect(() => () => {
        if (avatarCropSource?.url) {
            URL.revokeObjectURL(avatarCropSource.url);
        }
    }, [avatarCropSource]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const handleAvatarClick = () => fileInputRef.current?.click();

    const resetAvatarCropSource = () => {
        setAvatarCropSource((current) => {
            if (current?.url) {
                URL.revokeObjectURL(current.url);
            }

            return null;
        });
    };

    const handleAvatarChange = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';

        if (!file || !user?.id) return;

        if (!isSupportedAvatarFile(file)) {
            const message = 'Для аватара поддерживаются только JPG, PNG, GIF и WEBP.';
            setAvatarError(message);
            showToast('error', message);
            return;
        }

        setAvatarError('');
        const previewUrl = URL.createObjectURL(file);

        setAvatarCropSource((current) => {
            if (current?.url) {
                URL.revokeObjectURL(current.url);
            }

            return { file, url: previewUrl };
        });
    };

    const handleAvatarCropConfirm = async (croppedFile) => {
        if (!user?.id) return;

        if (croppedFile.size > MAX_AVATAR_SIZE_BYTES) {
            const message = 'Файл аватара слишком большой. Максимальный размер — 3 МБ.';
            setAvatarError(message);
            showToast('error', message);
            return;
        }

        setUploadingAvatar(true);
        setAvatarError('');

        try {
            const data = await userService.uploadAvatar(user.id, croppedFile);

            if (data.status === 'success') {
                if (data.user) {
                    updateUser(data.user);
                } else if (data.avatar_url) {
                    updateUser({ ...user, avatar_url: data.avatar_url });
                }

                resetAvatarCropSource();
                showToast('success', 'Аватар загружен');
            } else {
                const message = data.message || 'Ошибка загрузки аватара';
                setAvatarError(message);
                showToast('error', message);
            }
        } catch (error) {
            console.error(error);
            const message = getAvatarErrorMessage(error);
            setAvatarError(message);
            showToast('error', message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleAvatarDelete = async () => {
        if (!user?.id) return;

        setUploadingAvatar(true);
        setAvatarError('');
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
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white">Загрузка...</div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
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

                            <p className="mt-3 max-w-xs text-xs text-gray-500">
                                JPG, PNG, GIF, WEBP. После выбора можно обрезать изображение под аватар. Максимальный размер итогового файла — 3 МБ.
                            </p>
                            {avatarError && <p className="mt-2 max-w-xs text-sm text-red-400">{avatarError}</p>}
                        </div>

                        {/* Информация о пользователе */}
                        <div className="flex-1 w-full">
                            {!isEditing ? (
                                <>
                                    <h2 className="text-3xl font-bold text-white mb-2">{user.name}</h2>
                                    <div className="flex items-center gap-2 text-gray-400 mb-4">
                                        <HiUser className="w-5 h-5" />
                                        <span>{user.email}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-gray-500">
                                        <span>ID: {user.id}</span>
                                        <span>•</span>
                                        <span>Зарегистрирован: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                </>
                            ) : (
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
                    </div>
                </div>
            </motion.div>

            <AvatarCropModal
                isOpen={Boolean(avatarCropSource)}
                imageUrl={avatarCropSource?.url}
                fileName={avatarCropSource?.file?.name}
                processing={uploadingAvatar}
                onClose={resetAvatarCropSource}
                onConfirm={handleAvatarCropConfirm}
            />
        </MainLayout>
    );
};

export default Profile;
