import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    HiAcademicCap,
    HiUserGroup,
    HiSparkles,
    HiArrowRight,
    HiCheckCircle,
    HiChartBar,
    HiDocumentText,
    HiPencil,
    HiMiniRectangleStack,
} from 'react-icons/hi2';
import LetterGlitch from '../components/LetterGlitch';
import Folder from '../components/Folder';
import Navbar from "../components/layout/Navbar";


const Landing = () => {
    const { scrollY } = useScroll();

    return (
        <div className="relative min-h-screen bg-dark overflow-hidden">
            {/* LetterGlitch фон */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <LetterGlitch
                    glitchSpeed={50}
                    centerVignette={false}
                    outerVignette={true}
                    smooth={true}
                />
            </div>

            {/* Градиентный оверлей */}
            <div className="fixed inset-0 bg-gradient-to-b from-transparent via-dark/60 to-dark z-0 pointer-events-none" />

            {/* Навигация */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-dark/80 backdrop-blur-lg border-b border-white/10">
                <div className="container-custom py-4">
                    <div className="flex items-center justify-between">
                        {/* Логотип */}
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300">
                                <HiAcademicCap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white">
                                AIditorium
                            </span>
                        </Link>

                        {/* Кнопки */}
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

            {/* Hero секция */}
            <section className="relative z-10 min-h-screen flex items-center pt-20">
                <div className="container-custom">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Левая колонка */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                        >
                            <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6">
                                Умное пространство для{' '}
                                <span className="gradient-text "> образования</span>
                            </h1>

                            <p className="text-xl text-gray-300 mb-8 leading-relaxed max-w-xl">
                                AIditorium — платформа, где искусственный интеллект помогает
                                студентам и преподавателям создавать образовательную среду.
                            </p>

                            <div className="flex flex-wrap gap-4 mb-12">
                                <Link to="/register" className="px-8 py-4 bg-gradient-primary rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-primary-start/25 transition flex items-center gap-2 group">
                                    Начать учиться
                                    <HiArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <a href="#features" className="px-8 py-4 border border-white/20 rounded-lg text-white font-semibold hover:bg-white/10 transition">
                                    Узнать больше
                                </a>
                            </div>


                        </motion.div>
                        {/* Правая колонка - НАША ПАПКА! */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="relative h-[500px] hidden lg:flex items-center justify-center"
                        >
                            <div className="relative">
                                {/* Внешнее свечение */}
                                <div className="absolute inset-0 bg-gradient-primary rounded-full blur-3xl opacity-30 animate-pulse" />

                                {/* Папка с контентом */}
                                <Folder
                                    color="#7B4AFF"
                                    size={1.9}
                                    items={[
                                        <div key="1" className="flex flex-col items-center p-1">
                                            <HiDocumentText className="w-8 h-8 text-purple-600" />
                                            <span className="text-xs mt-1 text-violet-900 font-bold">Лекции</span>
                                        </div>,
                                        <div key="3" className="flex flex-col items-center p-1">
                                            <HiMiniRectangleStack className="w-8 h-8 text-blue-600" />
                                            <span className="text-xs mt-1 text-blue-900 font-bold">Курсы</span>
                                        </div>,
                                        <div key="2" className="flex flex-col items-center ">
                                            <HiChartBar className="w-8 h-8 text-orange-600 mt-0.5 " />
                                            <span className="text-xs mt-1 text-orange-700 font-bold  ">Статистика</span>
                                        </div>
                                    ]}
                                    className="drop-shadow-2xl"
                                />


                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features секция */}
            <section id="features" className="relative z-10 py-32 bg-dark/90 backdrop-blur-sm">
                <div className="container-custom">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-4xl font-bold text-white mb-4">
                            Три способа проверки заданий
                        </h2>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                            Выбирайте удобный формат или комбинируйте их для лучшего результата
                        </p>
                    </motion.div>


                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Ручная проверка */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            className="group relative bg-white/[0.03] backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-blue-500/50 hover:bg-white/[0.05] transition-all duration-500 shadow-2xl overflow-hidden"
                        >
                            {/* Фоновое свечение при наведении */}
                            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 blur-[50px] group-hover:bg-blue-500/20 transition-all duration-500 rounded-full" />

                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br  from-blue-500 to-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20 transform group-hover:rotate-6 group-hover:scale-110 transition-transform duration-500">
                                <HiPencil className="w-8 h-8 text-white" />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Ручная проверка</h3>
                            <p className="text-gray-400 mb-8 leading-relaxed min-h-[72px]">
                                Классический метод для работ, требующих личного внимания и экспертного взгляда преподавателя.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    'Развернутые комментарии',
                                    'Индивидуальный подход',
                                    'Личный контакт'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                            <HiCheckCircle className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Автоматическая проверка (AI) - Выделена чуть сильнее */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.1, delay: 0.05 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            className="group relative bg-white/[0.06] backdrop-blur-xl rounded-3xl p-8 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-500 shadow-2xl shadow-purple-500/10 overflow-hidden"
                        >


                            {/* Фоновое свечение при наведении */}
                            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/10 blur-[50px] group-hover:bg-purple-500/30 transition-all duration-500 rounded-full" />

                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-8 shadow-lg shadow-purple-500/30 transform group-hover:-rotate-6 group-hover:scale-110 transition-transform duration-500">
                                <HiSparkles className="w-8 h-8 text-white" />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Автоматическая проверка</h3>
                            <p className="text-gray-400 mb-8 leading-relaxed min-h-[72px]">
                                Искусственный интеллект анализирует и оценивает работы студентов по любым предметам.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    'AI-анализ текста',
                                    'Проверка по критериям',
                                    'Мгновенная обратная связь'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                            <HiCheckCircle className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>

                        {/* Взаимная проверка */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            viewport={{ once: true }}
                            whileHover={{ y: -10 }}
                            className="group relative bg-white/[0.03] backdrop-blur-xl rounded-3xl p-8 border border-white/10 hover:border-pink-500/50 hover:bg-white/[0.05] transition-all duration-500 shadow-2xl overflow-hidden"
                        >
                            {/* Фоновое свечение при наведении */}
                            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-pink-500/10 blur-[50px] group-hover:bg-pink-500/20 transition-all duration-500 rounded-full" />

                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center mb-8 shadow-lg shadow-pink-500/20 transform group-hover:rotate-6 group-hover:scale-110 transition-transform duration-500">
                                <HiUserGroup className="w-8 h-8 text-white" />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Взаимная проверка</h3>
                            <p className="text-gray-400 mb-8 leading-relaxed min-h-[72px]">
                                Студенты учатся, проверяя других, а искусственный интеллект анализирует качество проверки.
                            </p>

                            <ul className="space-y-4">
                                {[
                                    'Распределение работ',
                                    'Двойная слепая проверка',
                                    'AI-валидация оценок'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                                            <HiCheckCircle className="w-4 h-4 text-pink-400" />
                                        </div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 py-12">
                <div className="container-custom">
                    <div className="text-center text-gray-400">
                        © 2026 AIditorium. Все права защищены.
                    </div>
                </div>
            </footer>
        </div>

    );
};

export default Landing;