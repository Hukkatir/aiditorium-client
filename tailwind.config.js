/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    start: '#4A6CF7',
                    end: '#7B4AFF',
                    glow: '#9D7BFF', // Добавьте эту строку
                },
                dark: {
                    DEFAULT: '#1A1E2B',
                    secondary: '#2A2F3F',
                }
            },
            backgroundImage: {
                'gradient-primary': 'linear-gradient(135deg, #4A6CF7, #7B4AFF)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}