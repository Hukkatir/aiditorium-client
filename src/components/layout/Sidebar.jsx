import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { HiAcademicCap, HiMiniRectangleStack } from 'react-icons/hi2';
import { useAuth } from '../../context/AuthContext';
import { courseService } from '../../services/courseService';
import { buildCoursePath } from '../../utils/routeUtils';

const Sidebar = ({ isOpen }) => {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCourses = async () => {
            if (!isAuthenticated) return;

            setLoading(true);
            try {
                const data = await courseService.getMyCourses();
                setCourses(data.courses?.data || []);
            } catch (error) {
                if (error.response?.status !== 404) {
                    console.error('Failed to load courses for sidebar', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, [isAuthenticated]);

    return (
        <AnimatePresence mode="wait">
            {isOpen && (
                <motion.aside
                    initial={{ x: -300, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -300, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="fixed left-0 top-[73px] z-20 h-[calc(100vh-73px)] w-64 overflow-y-auto border-r border-white/10 bg-black/40 backdrop-blur-xl"
                >
                    <div className="p-4">
                        <div className="mb-4">
                            <h2 className="text-lg font-bold text-white">
                                <Link to="/courses" className="flex items-center gap-2 transition hover:text-purple-400">
                                    <HiAcademicCap className="h-5 w-5 text-purple-400" />
                                    Мои курсы
                                </Link>
                            </h2>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-4">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                            </div>
                        ) : courses.length === 0 ? (
                            <p className="py-4 text-center text-sm text-gray-500">
                                У вас пока нет курсов
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {courses.map((course) => {
                                    const coursePath = buildCoursePath(course);
                                    const isActive = location.pathname === coursePath || location.pathname.startsWith(`${coursePath}/`);

                                    return (
                                        <li key={course.id}>
                                            <Link
                                                to={coursePath}
                                                className={`block rounded-lg px-3 py-2 text-sm transition ${
                                                    isActive
                                                        ? 'border-l-2 border-purple-400 bg-purple-600/20 text-purple-400'
                                                        : 'text-gray-300 hover:bg-white/5'
                                                }`}
                                            >
                                                {course.name}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="mt-5 border-t border-white/10 pt-4">
                            <Link
                                to="/my-tasks"
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                                    location.pathname === '/my-tasks'
                                        ? 'bg-purple-600/20 text-purple-300'
                                        : 'text-gray-300 hover:bg-white/5'
                                }`}
                            >
                                <HiMiniRectangleStack className="h-4 w-4" />
                                Мои задания
                            </Link>
                        </div>
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default Sidebar;
