import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MyProjects from './pages/MyProjects';
import Automation from './pages/Automation';
import Documentation from './pages/Documentation';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import './App.css';

const useBackendHealth = () => {
    const [status, setStatus] = useState('pending');
    useEffect(() => {
        const check = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/health');
                setStatus(res.ok ? 'online' : 'offline');
            } catch {
                setStatus('offline');
            }
        };
        check();
        const id = setInterval(check, 30000);
        return () => clearInterval(id);
    }, []);
    return status;
};

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const pollNotifications = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/automation/notifications');
                const data = await response.json();
                const notifs = data.notifications || [];

                if (notifs.length > notifications.length) {
                    setUnreadCount(notifs.length - notifications.length);
                }

                setNotifications(notifs);
            } catch (err) {
                // Silently fail
            }
        };

        pollNotifications();
        const interval = setInterval(pollNotifications, 2000);
        return () => clearInterval(interval);
    }, [notifications.length]);

    const handleClick = () => {
        setShowDropdown(!showDropdown);
        setUnreadCount(0);
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="notification-bell-container">
            <button
                className={`icon-btn notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
                title="Notifications"
                onClick={handleClick}
            >
                🔔
                {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                )}
            </button>

            {showDropdown && (
                <>
                    <div className="notification-overlay" onClick={() => setShowDropdown(false)} />
                    <div className="notification-dropdown">
                        <div className="notification-dropdown-header">
                            <h3>Automation Notifications</h3>
                            {notifications.length > 0 && (
                                <button
                                    className="notification-clear-btn"
                                    onClick={() => setNotifications([])}
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                        <div className="notification-list">
                            {notifications.length === 0 ? (
                                <div className="notification-empty">
                                    No notifications yet
                                </div>
                            ) : (
                                notifications.slice().reverse().map((notif, idx) => (
                                    <div
                                        key={idx}
                                        className={`notification-item ${notif.type}`}
                                    >
                                        <div className="notification-icon">
                                            {notif.type === 'success' ? '✓' : '✗'}
                                        </div>
                                        <div className="notification-content">
                                            <div className="notification-message">
                                                {notif.message}
                                            </div>
                                            <div className="notification-time">
                                                {formatTime(notif.timestamp)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

function App() {
    const backendStatus = useBackendHealth();

    return (
        <Router>
            <div className="app">
                <aside className="sidebar">
                    <div className="sidebar-header">
                        <div className="sidebar-logo">
                            <div className="logo-icon">⚡</div>
                            <div className="logo-text">
                                <div className="logo-title">SOP → AI Training System</div>
                                <div className="logo-subtitle">INTELLIGENT SOP PROCESSING</div>
                            </div>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">📊</span>
                            <span className="nav-label">Dashboard</span>
                        </NavLink>
                        <NavLink to="/projects" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">📁</span>
                            <span className="nav-label">My Projects</span>
                        </NavLink>
                        <NavLink to="/automation" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">⚙️</span>
                            <span className="nav-label">Automation</span>
                        </NavLink>
                        <NavLink to="/documentation" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">📄</span>
                            <span className="nav-label">Documentation</span>
                        </NavLink>
                    </nav>

                    <div className="sidebar-footer">
                        <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">⚙️</span>
                            <span className="nav-label">Settings</span>
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <span className="nav-icon">👤</span>
                            <span className="nav-label">Profile</span>
                        </NavLink>
                    </div>
                </aside>

                <main className="main-content">
                    <header className="top-bar">
                        <div className="search-bar">
                            <span className="search-icon">🔍</span>
                            <input type="text" placeholder="SEARCH PROJECTS..." />
                        </div>
                        <div className="top-bar-actions">
                            <NotificationBell />
                            <button className="icon-btn" title="Help">❓</button>
                            <button className="icon-btn" title="Alerts">⚠️</button>
                            <div className="system-status">
                                <span className="status-label">SYSTEM STATUS</span>
                                <span className={`status-indicator ${backendStatus}`}>
                                    {backendStatus === 'online' ? '🟢 ONLINE' : '🔴 OFFLINE'}
                                </span>
                            </div>
                            <div className="user-avatar">👤</div>
                        </div>
                    </header>

                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/projects" element={<MyProjects />} />
                        <Route path="/automation" element={<Automation />} />
                        <Route path="/documentation" element={<Documentation />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;
