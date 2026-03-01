import logo from './logo.svg';
/*import './App.css';*/
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from "./pages/Auth";
function App() {
  return (
    <div className="App">
        <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
        </Routes>
    </div>
  );
}

export default App;
