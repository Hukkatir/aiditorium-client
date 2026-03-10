import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
    HiEnvelope,
    HiLockClosed,
    HiUser,
    HiAcademicCap,
    HiArrowRight
} from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext'; // если используем тосты

const Auth = () => {
    const navigate = useNavigate();
    const { login, register, isAuthenticated } = useAuth();
    const { showToast } = useToast(); // если есть ToastContext
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });
    const [isLoading, setIsLoading] = useState(false);

    // Состояния для ошибок валидации (поле → сообщение)
    const [fieldErrors, setFieldErrors] = useState({});

    // Общая ошибка (если не привязана к полю)
    const [generalError, setGeneralError] = useState('');

    // Редирект, если уже авторизован
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/profile');
        }
    }, [isAuthenticated, navigate]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Очищаем ошибку поля при вводе
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: '' }));
        }
        // Очищаем общую ошибку
        if (generalError) setGeneralError('');
    };

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setFormData({ name: '', email: '', password: '' });
        setFieldErrors({});
        setGeneralError('');
    };

    // Клиентская валидация перед отправкой
    const validateForm = () => {
        const errors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!formData.email.trim()) {
            errors.email = 'Email обязателен';
        } else if (!emailRegex.test(formData.email)) {
            errors.email = 'Введите корректный email (например, name@domain.com)';
        }

        if (!formData.password) {
            errors.password = 'Пароль обязателен';
        } else if (formData.password.length < 8) {
            errors.password = 'Пароль должен быть не менее 8 символов';
        }

        if (!isLogin && !formData.name.trim()) {
            errors.name = 'Имя обязательно';
        }

        return errors;
    };

    // Маппинг английских сообщений с сервера на русские (можно расширить)
    const translateServerError = (field, message) => {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('already been taken') ||
            lowerMsg.includes('already used') ||
            lowerMsg.includes('already exists')) {

            if (field === 'email') {
                return 'Эта почта уже зарегистрирована';
            }
            // Если вдруг для другого поля (например, name) будет такое сообщение
            return 'Такое значение уже используется';
        }

        if (lowerMsg.includes('required') || lowerMsg.includes('обязательно')) {
            return 'Поле обязательно для заполнения';
        }
        if (lowerMsg.includes('email') && lowerMsg.includes('valid')) {
            return 'Введите корректную почту';
        }
        if (lowerMsg.includes('password') && lowerMsg.includes('least 8 characters')) {
            return 'Пароль должен быть не менее 8 символов';
        }
        if (lowerMsg.includes('already taken') || lowerMsg.includes('уже используется')) {
            return 'Эта почта уже зарегистрирована';
        }
        if (lowerMsg.includes('credentials') || lowerMsg.includes('неверные данные')) {
            return 'Неверная почта или пароль';
        }
        // Если не нашли соответствия, возвращаем исходное сообщение (или можно заменить на общее)
        return message;
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); // отключаем стандартную отправку
        setFieldErrors({});
        setGeneralError('');

        // Клиентская валидация
        const clientErrors = validateForm();
        if (Object.keys(clientErrors).length > 0) {
            setFieldErrors(clientErrors);
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                await login({ email: formData.email, password: formData.password });
            } else {
                await register({ name: formData.name, email: formData.email, password: formData.password });
            }
            // Редирект произойдёт через useEffect
        } catch (err) {
            console.error('Auth error:', err);

            // Обработка ошибок от сервера
            if (err.response?.status === 422 && err.response.data?.errors) {
                // Ошибки валидации (поля)
                const serverErrors = {};
                Object.entries(err.response.data.errors).forEach(([field, messages]) => {
                    // Берём первое сообщение и переводим
                    serverErrors[field] = translateServerError(field, messages[0]);
                });
                setFieldErrors(serverErrors);
            } else if (err.response?.data?.message) {
                // Общая ошибка (например, 401)
                const translated = translateServerError('general', err.response.data.message);
                setGeneralError(translated);
                // Или показать через toast:
                // showToast('error', translated);
            } else {
                // Сетевая ошибка или что-то ещё
                setGeneralError('Ошибка подключения к серверу. Попробуйте позже.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#0A0A0B]">
            {/* Фон (без изменений) */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#7c3aed10_0%,transparent_50%)]" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative z-10 w-full max-w-[440px]"
            >
                {/* Логотип */}
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center gap-2 group">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-xl shadow-purple-500/20">
                            <HiAcademicCap className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-3xl font-bold text-white tracking-tight">AIditorium</span>
                    </Link>
                </div>

                {/* Форма */}
                <div className="bg-white/[0.02] backdrop-blur-3xl rounded-[32px] p-8 md:p-10 border border-white/10 shadow-2xl shadow-black/50">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight text-center">
                            {isLogin ? 'Вход в систему' : 'Регистрация'}
                        </h2>
                    </div>

                    {/* Общая ошибка (если есть) */}
                    <AnimatePresence>
                        {generalError && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl"
                            >
                                <p className="text-red-400 text-sm text-center">{generalError}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} noValidate className="space-y-4">
                        {/* Поле Имя (только для регистрации) */}
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                        Имя
                                    </label>
                                    <div className="relative">
                                        <HiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Введите ваше имя"
                                            className={`w-full bg-white/[0.03] border rounded-2xl py-4 pl-12 pr-4 text-white outline-none transition-all placeholder:text-gray-700 ${
                                                fieldErrors.name
                                                    ? 'border-red-500/50 focus:border-red-500'
                                                    : 'border-white/10 focus:border-purple-500/50'
                                            }`}
                                            disabled={isLoading}
                                        />
                                    </div>
                                    {fieldErrors.name && (
                                        <motion.p
                                            initial={{ opacity: 0, y: -5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-400 text-sm mt-1 ml-1"
                                        >
                                            {fieldErrors.name}
                                        </motion.p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                Email
                            </label>
                            <div className="relative">
                                <HiEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    placeholder="Введите почту"
                                    className={`w-full bg-white/[0.03] border rounded-2xl py-4 pl-12 pr-4 text-white outline-none transition-all placeholder:text-gray-700 ${
                                        fieldErrors.email
                                            ? 'border-red-500/50 focus:border-red-500'
                                            : 'border-white/10 focus:border-purple-500/50'
                                    }`}
                                    disabled={isLoading}
                                />
                            </div>
                            {fieldErrors.email && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400 text-sm mt-1 ml-1"
                                >
                                    {fieldErrors.email}
                                </motion.p>
                            )}
                        </div>

                        {/* Пароль */}
                        <div>
                            <div className="flex justify-between mb-2 ml-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Пароль
                                </label>
                              {/*  {isLogin && (
                                    <button
                                        type="button"
                                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Забыли?
                                    </button>
                                )}*/}
                            </div>
                            <div className="relative">
                                <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Введите пароль"
                                    className={`w-full bg-white/[0.03] border rounded-2xl py-4 pl-12 pr-4 text-white outline-none transition-all placeholder:text-gray-700 ${
                                        fieldErrors.password
                                            ? 'border-red-500/50 focus:border-red-500'
                                            : 'border-white/10 focus:border-purple-500/50'
                                    }`}
                                    disabled={isLoading}
                                />
                            </div>
                            {fieldErrors.password && (
                                <motion.p
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-400 text-sm mt-1 ml-1"
                                >
                                    {fieldErrors.password}
                                </motion.p>
                            )}
                        </div>

                        {/* Кнопка отправки */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 group mt-6 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span>Загрузка...</span>
                            ) : (
                                <>
                                    {isLogin ? 'Войти' : 'Создать аккаунт'}
                                    <HiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Переключение режима */}
                    <div className="mt-8 text-center border-t border-white/5 pt-6">
                        <p className="text-gray-400 text-sm">
                            {isLogin ? 'Новый пользователь?' : 'Уже зарегистрированы?'}
                            <button
                                onClick={toggleMode}
                                className="ml-2 text-white font-bold hover:text-purple-400 transition-colors"
                                disabled={isLoading}
                            >
                                {isLogin ? 'Создать профиль' : 'Войти в систему'}
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Auth;