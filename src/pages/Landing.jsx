import React from 'react';
import { motion } from 'framer-motion';
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
    HiMiniUserCircle,
} from 'react-icons/hi2';
import LetterGlitch from '../components/LetterGlitch';
import Folder from '../components/Folder';

const featureCards = [
    {
        title: 'Ручная проверка',
        description: 'Классический метод для работ, требующих личного внимания и экспертного взгляда преподавателя.',
        icon: HiPencil,
        iconClassName: 'bg-blue-500/15 text-blue-200 border-blue-400/20',
        activeClassName: 'hover:border-blue-400/35',
        items: ['Развернутые комментарии', 'Индивидуальный подход', 'Личный контакт']
    },
    {
        title: 'Автоматическая проверка',
        description: 'Искусственный интеллект анализирует и оценивает работы студентов по заданным критериям.',
        icon: HiSparkles,
        iconClassName: 'bg-purple-500/15 text-purple-100 border-purple-400/25',
        activeClassName: 'border-purple-500/25 bg-purple-500/[0.07] hover:border-purple-400/45',
        items: ['AI-анализ текста', 'Проверка по критериям', 'Быстрая обратная связь']
    },
    {
        title: 'Взаимная проверка',
        description: 'Студенты учатся анализировать решения друг друга, а преподаватель видит результаты проверки.',
        icon: HiUserGroup,
        iconClassName: 'bg-pink-500/15 text-pink-100 border-pink-400/20',
        activeClassName: 'hover:border-pink-400/35',
        items: ['Распределение работ', 'Слепой режим', 'Оценка и комментарий']
    }
];

const Landing = () => {
    return (
        <div className="relative min-h-screen bg-dark overflow-hidden">
            {/* LetterGlitch фон */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <LetterGlitch
                    glitchSpeed={120}
                    centerVignette={false}
                    outerVignette={true}
                    smooth={true}
                />
            </div>

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

                            <Link
                                to="/auth"
                                className="inline-flex items-center gap-2 rounded-xl border border-purple-400/20 bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/15 transition duration-300 hover:-translate-y-0.5 hover:shadow-purple-500/25"
                            >
                                <HiMiniUserCircle className="h-5 w-5 text-white" />
                                Войти
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
                                <Link to="/auth" className="px-8 py-4 bg-gradient-primary rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-primary-start/25 transition flex items-center gap-2 group">
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
                                <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-20 blur-3xl" />

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


                    <div className="grid gap-5 md:grid-cols-3">
                        {featureCards.map((feature) => {
                            const Icon = feature.icon;

                            return (
                                <article
                                    key={feature.title}
                                    className={`group rounded-3xl border border-white/10 bg-[#1A1E2B]/80 p-6 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.045] ${feature.activeClassName}`}
                                >
                                    <div className={`mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border ${feature.iconClassName}`}>
                                        <Icon className="h-7 w-7" />
                                    </div>

                                    <h3 className="text-2xl font-bold text-white">{feature.title}</h3>
                                    <p className="mt-4 min-h-[72px] text-sm leading-6 text-gray-400">
                                        {feature.description}
                                    </p>

                                    <ul className="mt-7 space-y-3">
                                        {feature.items.map((item) => (
                                            <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-purple-400/20 bg-purple-500/10 text-purple-200">
                                                    <HiCheckCircle className="h-4 w-4" />
                                                </span>
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </article>
                            );
                        })}
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
