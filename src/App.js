import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from "./pages/Auth";
import Profile from './pages/Profile';
import Courses from './pages/Courses';
import CourseDetailPage from './pages/CourseDetailPage';
import DisciplineDetailPage from './pages/DisciplineDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
// Защищённый маршрут (без Layout – Layout уже внутри страниц)
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/auth" replace />;
    }
    return children;
};

// Публичный маршрут (без Layout)
const PublicRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    if (isAuthenticated) {
        return <Navigate to="/courses" replace />;
    }
    return children;
};

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={
                    <PublicRoute>
                        <Auth />
                    </PublicRoute>
                } />

                {/* Защищённые страницы – они сами оборачивают себя в MainLayout */}
                <Route path="/profile" element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } />
                <Route path="/courses" element={
                    <ProtectedRoute>
                        <Courses />
                    </ProtectedRoute>
                } />
                <Route path="/courses/:courseId" element={
                    <ProtectedRoute>
                        <CourseDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug" element={
                    <ProtectedRoute>
                        <CourseDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug" element={
                    <ProtectedRoute>
                        <DisciplineDetailPage />
                    </ProtectedRoute>
                } />
                <Route path="/course/:courseIdOrSlug/discipline/:disciplineIdOrSlug/task/:taskNumber" element={
                    <ProtectedRoute>
                        <TaskDetailPage />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
