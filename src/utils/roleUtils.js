export const getGlobalRoleName = (userOrRole = null) => {
    const role = userOrRole?.role?.name
        || userOrRole?.roleName
        || userOrRole?.role_name
        || userOrRole?.name
        || userOrRole;

    return String(role || '').trim().toLowerCase();
};

export const isGlobalAdmin = (user = null) => {
    const roleName = getGlobalRoleName(user);

    return roleName === 'admin' || (!roleName && Number(user?.role_id) === 1);
};

export const formatGlobalRoleLabel = (role = '') => {
    const roleName = getGlobalRoleName(role);

    if (roleName === 'admin') {
        return 'Админ';
    }

    if (roleName === 'user') {
        return 'Пользователь';
    }

    return roleName || 'Не указана';
};

export const formatCourseRoleLabel = (role = '') => {
    const roleName = String(role || '').trim().toLowerCase();

    if (roleName === 'teacher') {
        return 'Преподаватель';
    }

    if (roleName === 'student') {
        return 'Ученик';
    }

    return roleName || 'Не указана';
};
