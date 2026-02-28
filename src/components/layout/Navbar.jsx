/*
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiAcademicCap } from 'react-icons/hi2';


const Navbar = () => {
    const location = useLocation();
    const { isAuthenticated, user, logout } = useAuthStore();

    /!*!// Не показываем навбар на страницах авторизации?
    const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
*!/
    // if (isAuthPage) return null; // Раскомментировать если не нужен навбар на auth страницах

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-white/10">
            <div className="container-custom py-4">
                <div className="flex items-center justify-between">
                    {/!* Логотип *!/}
                    <Link to="/" className="flex items-center gap-2 group">
                        <motion.div
                            whileHover={{ rotate: 12 }}
                            className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center"
                        >
                            <HiAcademicCap className="w-6 h-6 text-white" />
                        </motion.div>
                        <span className="text-2xl font-bold text-white">
              AIditorium
            </span>
                    </Link>

                    {/!* Кнопки входа/регистрации или профиль *!/}
                    <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                            <>
                                <Link to="/dashboard">
                                    <Button variant="outline" size="sm">
                                        Личный кабинет
                                    </Button>
                                </Link>
                                <Button variant="primary" size="sm" onClick={logout}>
                                    Выйти
                                </Button>
                            </>
                        ) : (
                            <>
                                <Link to="/login">
                                    <Button variant="outline" size="sm">
                                        Вход
                                    </Button>
                                </Link>
                                <Link to="/register">
                                    <Button variant="primary" size="sm">
                                        Регистрация
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/!* Навигация *!/}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-white/10">
                <div className="container-custom py-4">
                    <div className="flex items-center justify-between">
                        {/!* Логотип *!/}
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                                <HiAcademicCap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white">
                                AIditorium
                            </span>
                        </Link>

                        {/!* Кнопки *!/}
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="px-4 py-2 border border-white/20 rounded-lg text-white hover:bg-white/10 transition">
                                Вход
                            </Link>
                            <Link to="/register" className="px-4 py-2 bg-gradient-primary rounded-lg text-white hover:shadow-lg hover:shadow-primary-start/25 transition">
                                Регистрация
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
        </nav>
    );
};


export default Navbar;*/
