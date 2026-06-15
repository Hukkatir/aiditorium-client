import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CourseCard from '../components/courses/CourseCard';
import MainLayout from '../components/layout/MainLayout';
import { courseService } from '../services/courseService';
import { buildCoursePath } from '../utils/routeUtils';

const ArchivedCoursesPage = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCourses = async () => {
            setLoading(true);

            try {
                const data = await courseService.getMyCourses({ per_page: 200 });
                setCourses((data.courses?.data || []).filter((course) => course.status === 'archived'));
            } catch (error) {
                if (error.response?.status !== 404) {
                    console.error('Failed to load archived courses', error);
                }
                setCourses([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCourses();
    }, []);

    if (loading) {
        return (
            <MainLayout>
                <div className="flex min-h-[50vh] items-center justify-center">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mb-6">
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Архив</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">Архивированные курсы</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                    Здесь находятся курсы, которые были перенесены в архив. Они не отображаются в обычном списке моих курсов.
                </p>
            </div>

            {courses.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center"
                >
                    <p className="text-xl text-gray-400">Архивированных курсов нет</p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {courses.map((course) => (
                        <CourseCard
                            key={course.id}
                            course={course}
                            onClick={() => navigate(buildCoursePath(course))}
                        />
                    ))}
                </div>
            )}
        </MainLayout>
    );
};

export default ArchivedCoursesPage;
