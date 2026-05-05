import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    HiAcademicCap,
    HiPlus,
    HiUserPlus,
    HiArrowRightOnRectangle,
    HiPencilSquare,
    HiMiniRectangleStack,
    HiBars3,
    HiXMark
} from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import CreateCourseModal from '../courses/CreateCourseModal';
import JoinCourseModal from '../courses/JoinCourseModal';

const Navbar = ({ sidebarOpen, onToggleSidebar }) => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showJoinModal, setShowJoinModal] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/auth');
    };

    const handleCreateSuccess = () => {
        setShowCreateModal(false);
        window.location.reload(); // или обновить список курсов через контекст
    };

    const handleJoinSuccess = () => {
        setShowJoinModal(false);
        window.location.reload();
    };

    return (
        <>
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-lg">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {/* Кнопка бургер для открытия/закрытия сайдбара */}
                        {isAuthenticated && (
                            <button
                                onClick={onToggleSidebar}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                            >
                                {sidebarOpen ? (
                                    <HiXMark className="w-5 h-5" />
                                ) : (
                                    <HiBars3 className="w-5 h-5" />
                                )}
                            </button>
                        )}

                        {/* Логотип */}
                        <Link to={isAuthenticated ? "/courses" : "/"} className="flex items-center gap-2 group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                <HiAcademicCap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">AIditorium</span>
                        </Link>
                    </div>

                    {/* Кнопки для авторизованных */}
                    {isAuthenticated && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                                title="Создать курс"
                            >
                                <HiPlus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="p-2 text-gray-400 hover:text-white transition-colors"
                                title="Присоединиться к курсу"
                            >
                                <HiUserPlus className="w-5 h-5" />
                            </button>

                            {/* Выпадающее меню профиля */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                        {user?.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-white">
                                                {user?.name?.charAt(0) || 'U'}
                                            </span>
                                        )}
                                    </div>
                                    <span className="hidden md:block text-sm text-white">{user?.name}</span>
                                </button>

                                <AnimatePresence>
                                    {dropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 mt-2 w-64 bg-[#1A1A1C] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                                        >
                                            <div className="p-4 border-b border-white/10">
                                                <p className="font-semibold text-white">{user?.name}</p>
                                                <p className="text-sm text-gray-400 truncate">{user?.email}</p>
                                            </div>
                                            <div className="p-2">
                                                <button
                                                    onClick={() => {
                                                        setDropdownOpen(false);
                                                        navigate('/my-tasks');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <HiMiniRectangleStack className="w-4 h-4" />
                                                    <span>Мои задания</span>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setDropdownOpen(false);
                                                        navigate('/profile');
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-gray-300 hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <HiPencilSquare className="w-4 h-4" />
                                                    <span>Редактировать профиль</span>
                                                </button>
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <HiArrowRightOnRectangle className="w-4 h-4" />
                                                    <span>Выйти</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Если не авторизован – показываем кнопку входа */}
                    {!isAuthenticated && (
                        <Link
                            to="/auth"
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white font-medium hover:shadow-lg transition"
                        >
                            Войти
                        </Link>
                    )}
                </div>
            </nav>

            {/* Модалки */}
            <CreateCourseModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleCreateSuccess}
            />
            <JoinCourseModal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                onSuccess={handleJoinSuccess}
            />
        </>
    );
};

export default Navbar;
