import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/authService';
import {
    AUTH_STATE_EVENT,
    clearAuthSession,
    getStoredToken,
    getStoredUser,
    setAuthSession
} from '../services/authStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const syncAuthState = () => {
            const token = getStoredToken();
            const savedUser = getStoredUser();

            if (token && savedUser) {
                setUser(savedUser);
                return;
            }

            if (token || savedUser) {
                clearAuthSession();
            }

            setUser(null);
        };

        const handleAuthStateChange = (event) => {
            const nextToken = event.detail?.token;
            const nextUser = event.detail?.user;

            setUser(nextToken && nextUser ? nextUser : null);
        };

        syncAuthState();
        window.addEventListener(AUTH_STATE_EVENT, handleAuthStateChange);
        setLoading(false);

        return () => {
            window.removeEventListener(AUTH_STATE_EVENT, handleAuthStateChange);
        };
    }, []);

    const login = async (credentials) => {
        const { user, token } = await authService.login(credentials);
        setAuthSession({ token, user });
        setUser(user);
    };

    const register = async (userData) => {
        const { user, token } = await authService.register(userData);
        setAuthSession({ token, user });
        setUser(user);
    };

    const logout = async () => {
        try {
            await authService.logout();
        } catch (error) {
            console.error('Logout error', error);
        } finally {
            clearAuthSession();
            setUser(null);
        }
    };

    const updateUser = (updatedUser) => {
        setAuthSession({ user: updatedUser });
        setUser(updatedUser);
    };

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
