import axios from 'axios';

const apiClient = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'https://aiditorium.ru/api',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // 'Accept-Language' можно добавить позже из настроек пользователя
    },
});

// Интерсептор для добавления токена к каждому запросу
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Интерсептор для обработки ошибок (например, 401)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Токен протух — разлогиниваем
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            // Можно перенаправить на страницу логина, но лучше сделать это через контекст
            window.location.href = '/auth';
        }
        return Promise.reject(error);
    }
);

export default apiClient;