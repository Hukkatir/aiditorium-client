import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { courseService } from '../services/courseService';
import CourseCard from '../components/courses/CourseCard';
import MainLayout from '../components/layout/MainLayout';

const Courses = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const data = await courseService.getMyCourses();
            setCourses(data.courses?.data || []);
        } catch (error) {
            if (error.response?.status !== 404) {
                console.error('Failed to load courses', error);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            {courses.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-20"
                >
                    <p className="text-gray-400 text-xl mb-6">
                        У вас пока нет курсов
                    </p>
                    <p className="text-gray-500">
                        Используйте кнопки в верхней панели, чтобы создать курс или присоединиться по коду.
                    </p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map(course => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            onClick={() => navigate(`/courses/${course.slug}`)} // используем slug
                        />
                    ))}
                </div>
            )}
        </MainLayout>
    );
};

export default Courses;