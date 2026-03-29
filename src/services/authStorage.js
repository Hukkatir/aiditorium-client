export const AUTH_STATE_EVENT = 'aiditorium-auth-state-changed';

const dispatchAuthStateChange = () => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent(AUTH_STATE_EVENT, {
        detail: {
            token: getStoredToken(),
            user: getStoredUser()
        }
    }));
};

export const getStoredToken = () => {
    if (typeof localStorage === 'undefined') return '';

    return localStorage.getItem('authToken') || '';
};

export const getStoredUser = () => {
    if (typeof localStorage === 'undefined') return null;

    const savedUser = localStorage.getItem('user');

    if (!savedUser) return null;

    try {
        return JSON.parse(savedUser);
    } catch {
        return null;
    }
};

export const setAuthSession = ({ token, user } = {}) => {
    if (typeof localStorage === 'undefined') return;

    if (token !== undefined) {
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    if (user !== undefined) {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }

    dispatchAuthStateChange();
};

export const clearAuthSession = () => {
    if (typeof localStorage === 'undefined') return;

    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    dispatchAuthStateChange();
};
