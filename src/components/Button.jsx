import React from 'react';
import { motion } from 'framer-motion';

const Button = ({
                    children,
                    variant = 'primary',
                    size = 'md',
                    onClick,
                    className = '',
                    disabled = false,
                    type = 'button',
                    fullWidth = false,
                    isLoading = false
                }) => {
    const baseStyles = 'rounded-lg font-semibold transition-all duration-200 inline-flex items-center justify-center';

    const variants = {
        primary: 'bg-gradient-primary text-white hover:shadow-lg hover:shadow-primary-start/25',
        secondary: 'bg-secondary-green text-white hover:bg-opacity-90',
        outline: 'border-2 border-white/20 text-white hover:bg-white hover:text-primary-start hover:border-white'
    };

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg'
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type={type}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
            onClick={onClick}
            disabled={disabled || isLoading}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : children}
        </motion.button>
    );
};

export default Button;