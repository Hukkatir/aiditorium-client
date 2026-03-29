import axios from 'axios';
import { clearAuthSession, getStoredToken, setAuthSession } from './authStorage';

const baseURL = process.env.REACT_APP_API_URL || 'https://aiditorium.ru/api';
const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
};

const apiClient = axios.create({
    baseURL,
    headers: defaultHeaders,
});

const refreshClient = axios.create({
    baseURL,
    headers: defaultHeaders,
});

let refreshPromise = null;

const isAuthRequest = (url = '') => ['/login', '/register', '/logout', '/refresh']
    .some((authUrl) => url.endsWith(authUrl) || url.includes(authUrl));

const refreshToken = async () => {
    const token = getStoredToken();

    if (!token) {
        throw new Error('Missing auth token');
    }

    const response = await refreshClient.post('/refresh', null, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    const nextToken = response.data?.authorization?.token;

    if (!nextToken) {
        throw new Error('Missing refreshed token');
    }

    if (response.data?.user) {
        setAuthSession({ token: nextToken, user: response.data.user });
    } else {
        setAuthSession({ token: nextToken });
    }

    return nextToken;
};

// Интерсептор для добавления токена к каждому запросу
apiClient.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status !== 401 ||
            !originalRequest ||
            originalRequest._retry ||
            isAuthRequest(originalRequest.url)
        ) {
            return Promise.reject(error);
        }

        if (!getStoredToken()) {
            clearAuthSession();
            return Promise.reject(error);
        }

        originalRequest._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = refreshToken().finally(() => {
                    refreshPromise = null;
                });
            }

            const nextToken = await refreshPromise;
            originalRequest.headers = originalRequest.headers ?? {};
            originalRequest.headers.Authorization = `Bearer ${nextToken}`;

            return apiClient(originalRequest);
        } catch (refreshError) {
            clearAuthSession();
            return Promise.reject(refreshError);
        }
    }
);

export default apiClient;
