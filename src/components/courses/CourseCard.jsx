import React from 'react';
import { motion } from 'framer-motion';

const CourseCard = ({ course, onClick }) => {
    const backgroundImage = course.background_logo_url || course.background_logo;

    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-xl border border-white/10"
            onClick={onClick}
        >
            <div
                className="h-40 bg-cover bg-center"
                style={
                    backgroundImage
                        ? { backgroundImage: `url(${backgroundImage})` }
                        : { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
                }
            >
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300" />
            </div>

            <div className="p-5 bg-white/[0.02] backdrop-blur">
                <h3 className="text-xl font-bold text-white mb-2 line-clamp-1">{course.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">{course.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>{course.disciplines_count || 0} дисциплин</span>
                    <span>{course.users_count || 0} участников</span>
                </div>
            </div>
        </motion.div>
    );
};

export default CourseCard;