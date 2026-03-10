/*
// Не используем сложную конфигурацию axios с интерцепторами пока
// Сделаем простой и рабочий вариант

const API_BASE_URL = 'https://aiditorium.ru/api';

// Простые функции для запросов
export const authService = {
    // Регистрация
    register: async (userData) => {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка при регистрации');
            }

            return data;
        } catch (error) {
            console.error('Register error:', error);
            throw error;
        }
    },

    // Вход
    login: async (credentials) => {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка при входе');
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Выход
    logout: async () => {
        const token = localStorage.getItem('authToken');

        try {
            const response = await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },

    // Получить данные пользователя
    getUser: async (userId) => {
        const token = localStorage.getItem('authToken');

        try {
            const response = await fetch(`${API_BASE_URL}/user/${userId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Get user error:', error);
            throw error;
        }
    }
};*/

import apiClient from './apiClient';

export const authService = {
    async login(credentials) {
        const response = await apiClient.post('/login', credentials);
        const { user, authorization } = response.data;
        return { user, token: authorization.token };
    },

    async register(userData) {
        const response = await apiClient.post('/register', userData);
        const { user, authorization } = response.data;
        return { user, token: authorization.token };
    },

    async logout() {
        await apiClient.post('/logout');
    },

    async getProfile() {
        const response = await apiClient.get('/user'); // предположительно
        return response.data;
    },

    async updateProfile(data) {
        const response = await apiClient.post('/user/edit', data);
        return response.data; // ожидаем обновлённого пользователя
    }
};
