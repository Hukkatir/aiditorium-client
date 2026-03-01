import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    HiEnvelope,
    HiLockClosed,
    HiUser,
    HiAcademicCap,
    HiArrowRight
} from 'react-icons/hi2';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);

    const toggleMode = () => setIsLogin(!isLogin);

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#0A0A0B]">
            {/* СТАБИЛЬНЫЙ ФОН */}
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
                {/* Лого (БЕЗ КУРСИВА) */}
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

                    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>

                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Имя</label>
                                    <div className="relative group">
                                        <HiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Введите ваше имя"
                                            className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all placeholder:text-gray-700"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 ml-1">Email</label>
                            <div className="relative group">
                                <HiEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="Введите почту"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all placeholder:text-gray-700"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2 ml-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Пароль</label>
                                {isLogin && <button className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Забыли?</button>}
                            </div>
                            <div className="relative group">
                                <HiLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
                                <input
                                    type="password"
                                    placeholder="Введите пароль"
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-purple-500/50 focus:bg-white/[0.06] transition-all placeholder:text-gray-700"
                                />
                            </div>
                        </div>

                        <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 group mt-6 active:scale-[0.98]">
                            {isLogin ? 'Войти' : 'Создать аккаунт'}
                            <HiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-white/5 pt-6">
                        <p className="text-gray-400 text-sm">
                            {isLogin ? 'Новый пользователь?' : 'Уже зарегистрированы?'}
                            <button
                                onClick={toggleMode}
                                className="ml-2 text-white font-bold hover:text-purple-400 transition-colors"
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