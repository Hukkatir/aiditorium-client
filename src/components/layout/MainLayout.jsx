import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const MainLayout = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();

    // Автоматически закрываем sidebar на мобильных устройствах
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white">
            {/* Фоновые эффекты (один раз для всех страниц) */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#7c3aed10_0%,transparent_50%)]" />
            </div>

            {/* Навбар (с кнопками создания/присоединения) */}
            <Navbar
                sidebarOpen={sidebarOpen}
                onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            />

            {/* Боковая панель с курсами (только для авторизованных) */}
            <Sidebar isOpen={sidebarOpen} />

            {/* Основной контент - адаптируется под состояние боковой панели */}
            <main
                className={`relative z-10 transition-all duration-300 ${
                    sidebarOpen ? 'ml-64' : 'ml-0'
                } p-4 md:p-6`}
            >
                <div className="container mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;
