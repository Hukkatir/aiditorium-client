import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    HiCamera,
    HiCheck,
    HiPencilSquare,
    HiTrash,
    HiUser,
    HiXMark
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
    'image/webp'
]);
const ALLOWED_AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

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

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setEditForm((previous) => ({ ...previous, [name]: value }));
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

    const handleAvatarChange = (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file || !user?.id) return;

        if (!isSupportedAvatarFile(file)) {
            const message = 'Для аватара поддерживаются только JPG, PNG и WEBP.';
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
        } catch (error) {
            console.error(error);
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
            email: editForm.email
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
        } catch (error) {
            console.error(error);
            showToast('error', error.response?.data?.message || 'Ошибка обновления');
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
                <div className="flex h-full items-center justify-center">
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
                className="mx-auto max-w-5xl space-y-6"
            >
                <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.14),_transparent_36%),rgba(255,255,255,0.03)] p-6 md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <p className="text-xs uppercase tracking-[0.32em] text-sky-200/70">Личный кабинет</p>
                            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">{user.name}</h1>
                            <p className="mt-4 text-sm leading-7 text-slate-300 md:text-base">
                                Управляйте аватаром и основными данными профиля в одном месте.
                            </p>
                        </div>

                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-700"
                            >
                                <HiPencilSquare className="h-5 w-5" />
                                Редактировать профиль
                            </button>
                        ) : (
                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-6 py-3 font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                                >
                                    <HiCheck className="h-5 w-5" />
                                    {saving ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-6 py-3 font-medium text-white transition hover:bg-white/20"
                                >
                                    <HiXMark className="h-5 w-5" />
                                    Отмена
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[300px,minmax(0,1fr)]">
                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
                        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Аватар</p>

                        <div className="mt-5 flex flex-col items-center text-center">
                            <div className="relative">
                                <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-xl shadow-purple-500/20">
                                    {avatarPreview ? (
                                        <img
                                            src={avatarPreview}
                                            alt="Avatar"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-5xl font-bold text-white">
                                            {user.name?.charAt(0) || 'U'}
                                        </span>
                                    )}

                                    {uploadingAvatar && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-5 flex w-full flex-wrap justify-center gap-3">
                                <button
                                    onClick={handleAvatarClick}
                                    disabled={uploadingAvatar}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                                >
                                    <HiCamera className="h-4 w-4" />
                                    Загрузить
                                </button>
                                {user.avatar_url && (
                                    <button
                                        onClick={handleAvatarDelete}
                                        disabled={uploadingAvatar}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                                    >
                                        <HiTrash className="h-4 w-4" />
                                        Удалить
                                    </button>
                                )}
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleAvatarChange}
                                accept="image/*"
                                className="hidden"
                            />

                            {avatarError && <p className="mt-4 max-w-xs text-sm text-red-400">{avatarError}</p>}
                        </div>
                    </section>

                    <section className="rounded-[32px] border border-white/10 bg-white/[0.03] p-6">
                        {!isEditing ? (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Профиль</p>
                                    <h2 className="mt-3 text-3xl font-semibold text-white">{user.name}</h2>
                                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-slate-300">
                                        <HiUser className="h-4 w-4" />
                                        {user.roleName || 'Пользователь'}
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Имя</p>
                                        <p className="mt-3 text-lg font-medium text-white">{user.name}</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Email</p>
                                        <p className="mt-3 break-all text-lg font-medium text-white">{user.email}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Редактирование</p>
                                    <h2 className="mt-3 text-2xl font-semibold text-white">Основные данные</h2>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-gray-400">Имя</label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={editForm.name}
                                            onChange={handleInputChange}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-semibold text-gray-400">Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={editForm.email}
                                            onChange={handleInputChange}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                        />
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                                    <p className="text-sm font-semibold text-white">Смена пароля</p>
                                    <p className="mt-1 text-sm text-gray-400">Оставьте поля пустыми, если пароль менять не нужно.</p>

                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-gray-400">Новый пароль</label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={editForm.password}
                                                onChange={handleInputChange}
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-2 block text-sm font-semibold text-gray-400">Подтверждение пароля</label>
                                            <input
                                                type="password"
                                                name="password_confirmation"
                                                value={editForm.password_confirmation}
                                                onChange={handleInputChange}
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-purple-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
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
