import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timeouts = useRef({});

    const showToast = useCallback((type, message, duration = 3000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, type, message }]);

        if (timeouts.current[id]) clearTimeout(timeouts.current[id]);
        timeouts.current[id] = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
            delete timeouts.current[id];
        }, duration);

        return id;
    }, []);

    const hideToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        if (timeouts.current[id]) {
            clearTimeout(timeouts.current[id]);
            delete timeouts.current[id];
        }
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                <AnimatePresence>
                    {toasts.map(toast => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 100 }}
                            className={`
                px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-lg
                ${toast.type === 'success'
                                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                : 'bg-red-500/20 border border-red-500/30 text-red-400'
                            }
              `}
                        >
                            <span className="font-medium">{toast.message}</span>
                            <button
                                onClick={() => hideToast(toast.id)}
                                className="hover:opacity-70 transition-opacity"
                            >
                                <HiXMark className="w-5 h-5" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};