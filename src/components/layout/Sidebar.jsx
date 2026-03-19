import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { HiAcademicCap } from 'react-icons/hi2';

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
                    className="fixed left-0 top-[73px] z-20 w-64 h-[calc(100vh-73px)] bg-black/40 backdrop-blur-xl border-r border-white/10 overflow-y-auto"
                >
                    <div className="p-4">
                        <h2 className="text-lg font-bold text-white mb-4">
                            <Link to="/courses" className="flex items-center gap-2 hover:text-purple-400 transition">
                                <HiAcademicCap className="w-5 h-5 text-purple-400" />
                                Мои курсы
                            </Link>
                        </h2>

                        {loading ? (
                            <div className="flex justify-center py-4">
                                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : courses.length === 0 ? (
                            <p className="text-gray-500 text-sm text-center py-4">
                                У вас пока нет курсов
                            </p>
                        ) : (
                            <ul className="space-y-1">
                                {courses.map(course => (
                                    <li key={course.id}>
                                        <Link
                                            to={`/courses/${course.id}`}
                                            className={`block px-3 py-2 rounded-lg text-sm transition ${
                                                location.pathname === `/courses/${course.id}`
                                                    ? 'bg-purple-600/20 text-purple-400 border-l-2 border-purple-400'
                                                    : 'text-gray-300 hover:bg-white/5'
                                            }`}
                                        >
                                            {course.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default Sidebar;