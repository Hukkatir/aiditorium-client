import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiClient from '../../services/apiClient';

const CourseCard = ({ course, onClick }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState([]);

    useEffect(() => {
        if (course.background_logo_url) {
            setImageUrl(course.background_logo_url);
            return;
        }

        if (course.background_logo_id) {
            const fetchFile = async () => {
                setLoading(true);
                try {
                    const response = await apiClient.get(`/file/${course.background_logo_id}`);
                    const path = response.data.file?.path || response.data.path;
                    if (path) {
                        setImageUrl(`https://aiditorium.ru/storage/${path}`);
                    }
                } catch (error) {
                    console.error('Ошибка загрузки обложки', error);
                } finally {
                    setLoading(false);
                }
            };
            fetchFile();
        }
    }, [course]);

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-xl border border-white/10"
            onClick={onClick}
        >
            {/* Обложка (без transition) */}
            <div
                className="h-40 bg-cover bg-center"
                style={
                    imageUrl
                        ? { backgroundImage: `url(${imageUrl})` }
                        : { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
                }
            >
                {/* Затемнение с transition */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300" />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            <div className="p-5 bg-white/[0.02] backdrop-blur">
                <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{course.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{course.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{course.disciplines_count || 0} дисциплин</span>{/*
                    <span> {users.length} участников</span>
                    <span className="text-gray-300">{users.length} участников</span>*/}
                </div>
            </div>
        </motion.div>
    );
};

export default CourseCard;