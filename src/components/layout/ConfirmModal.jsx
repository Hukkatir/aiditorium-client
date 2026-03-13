import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiXMark } from 'react-icons/hi2';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Подтвердить', cancelText = 'Отмена' }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#1A1A1C] rounded-2xl max-w-md w-full p-6 border border-white/10"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <HiXMark className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-gray-400 mb-6">{message}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition"
                        >
                            {cancelText}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default ConfirmModal;