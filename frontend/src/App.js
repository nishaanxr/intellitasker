import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './Login';

const API_URL = 'http://localhost:5000/api';

function App() {
  // --- Auth & data ---
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);

  // --- UI state ---
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- Forms ---
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    status: 'pending'
  });

  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: ''
  });

  // --- History modal ---
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTask, setHistoryTask] = useState(null);

  // --- Dark mode (Option A) ---
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const v = localStorage.getItem('ts_dark_mode');
      return v === null ? true : v === 'true'; // default to true for Option A
    } catch (e) {
      return true;
    }
  });

  // load current user from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // apply theme to document root (helpful if Tailwind dark is enabled)
  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('ts_dark_mode', String(darkMode));
    } catch (e) {
      // ignore
    }
  }, [darkMode]);

  // fetch data when authenticated
  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      fetchUsers();
    }
  }, [currentUser]);

  const getCurrentUserId = () => {
    return currentUser?.id || currentUser?._id || currentUser?._id;
  };

  // ---------- THEME COLORS (inline) ----------
  // Option A "professional black" palette
  const theme = {
    bg: darkMode ? '#050507' : 'linear-gradient(135deg,#f8fafc 0%, #eef2ff 50%, #f0f9ff 100%)', // keep gradient light-mode
    pageText: darkMode ? '#e6eef8' : '#0f172a',
    cardBg: darkMode ? '#0b0b0f' : '#ffffff',
    cardBorder: darkMode ? '#1f2937' : '#e6eef3',
    muted: darkMode ? '#98a0ac' : '#64748b',
    accentFrom: '#0ea5e9',
    accentTo: '#7c3aed'
  };

  // ---------- FETCH FUNCTIONS ----------
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/tasks`);
      if (currentUser && currentUser.role === 'member') {
        const myId = getCurrentUserId();
        const filtered = res.data.filter(t => {
          const assignedId = t.assignedTo?._id || t.assignedTo;
          return String(assignedId) === String(myId);
        });
        setTasks(filtered);
      } else {
        setTasks(res.data);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`);
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // ---------- CRUD / ACTIONS ----------
  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!(currentUser && currentUser.role === 'admin')) {
      alert('Only admins can create or edit tasks.');
      return;
    }
    try {
      setLoading(true);
      if (editingTask) {
        await axios.put(`${API_URL}/tasks/${editingTask._id}`, taskForm);
      } else {
        await axios.post(`${API_URL}/tasks`, taskForm);
      }
      setTaskForm({ title: '', description: '', assignedTo: '', status: 'pending' });
      setEditingTask(null);
      setShowTaskForm(false);
      await fetchTasks();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!(currentUser && currentUser.role === 'admin')) {
      alert('Only admins can create users.');
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API_URL}/users`, userForm);
      setUserForm({ name: '', email: '', password: '' });
      setShowUserForm(false);
      await fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Error creating user');
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (id) => {
    if (!(currentUser && currentUser.role === 'admin')) {
      alert('Only admins can delete tasks.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await axios.delete(`${API_URL}/tasks/${id}`, { params: { userId: getCurrentUserId() }});
      await fetchTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const editTask = (task) => {
    if (!(currentUser && currentUser.role === 'admin')) {
      alert('Only admins can edit tasks.');
      return;
    }
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo?._id || task.assignedTo,
      status: task.status
    });
    setShowTaskForm(true);
  };

  // Allowed transitions for members
  const allowedMemberTransitions = (currentStatus) => {
    if (currentStatus === 'pending') return ['in-progress'];
    if (currentStatus === 'in-progress') return ['completed'];
    return [];
  };

  // Inline status change
  const handleStatusChange = async (task, newStatus) => {
    const userId = getCurrentUserId();

    if (currentUser.role === 'member') {
      const allowed = allowedMemberTransitions(task.status);
      if (!allowed.includes(newStatus)) {
        alert('Invalid status transition.');
        return;
      }
    }

    try {
      setLoading(true);
      await axios.put(`${API_URL}/tasks/${task._id}`, {
        status: newStatus,
        userId // backend should verify
      });
      await fetchTasks();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Unable to update status.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setCurrentUser(null);
    setTasks([]);
    setUsers([]);
  };

  // ---------- UI helpers ----------
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500';
      case 'in-progress': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
      case 'in-progress': return 'bg-amber-50 text-amber-700 ring-amber-600/20';
      default: return 'bg-slate-50 text-slate-700 ring-slate-600/20';
    }
  };

  const isAdmin = currentUser?.role === 'admin';
  const currentUserId = getCurrentUserId();

  // ---------- RENDER ----------
  // top-level wrapper styles (inline) to ensure good dark-mode even without Tailwind dark configured
  const pageStyle = {
    background: theme.bg,
    color: theme.pageText,
    minHeight: '100vh'
  };
  const cardStyle = { background: theme.cardBg, borderColor: theme.cardBorder, color: theme.pageText };
  const mutedStyle = { color: theme.muted };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
  }

  return (
    <div style={pageStyle} className="min-h-screen">
      {/* Header */}
      <div style={cardStyle} className="bg-white border-b shadow-sm" >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" style={{ borderColor: theme.cardBorder }}>
          <div className="flex items-center justify-between">
            <div>
              <h1 style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})`, WebkitBackgroundClip: 'text', color: 'transparent' }} className="text-4xl font-bold">
                TaskSync
              </h1>
              <p style={mutedStyle} className="mt-1 text-sm">Streamline your team's workflow</p>
            </div>

            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: darkMode ? '#071024' : '#f1f5f9' }}>
                <svg className="w-5 h-5" fill="none" stroke={darkMode ? '#9fb7d9' : '#475569'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span style={{ color: theme.pageText }} className="text-sm font-medium">{currentUser.name}{currentUser.role ? ` (${currentUser.role})` : ''}</span>
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={() => setDarkMode(v => !v)}
                title="Toggle dark mode"
                className="px-3 py-2 rounded-xl border transition"
                style={{ borderColor: theme.cardBorder, color: theme.pageText }}
              >
                {darkMode ? '🌙 Dark' : '☀️ Light'}
              </button>

              {/* New Task (admin only) */}
              {isAdmin ? (
                <button
                  onClick={() => { setShowTaskForm(!showTaskForm); setEditingTask(null); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition shadow-md"
                  style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})`, color: '#fff' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  New Task
                </button>
              ) : (
                <div className="px-3 py-2 rounded-xl invisible">placeholder</div>
              )}

              {/* New User (admin only) */}
              {isAdmin ? (
                <button
                  onClick={() => setShowUserForm(!showUserForm)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border transition"
                  style={{ borderColor: theme.cardBorder, color: theme.pageText, background: darkMode ? '#071024' : '#fff' }}
                >
                  New User
                </button>
              ) : (
                <div className="px-3 py-2 rounded-xl invisible">placeholder</div>
              )}

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Form Modal (admin only) */}
        {isAdmin && showUserForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div style={cardStyle} className="rounded-2xl shadow-2xl max-w-md w-full p-8">
              <h2 className="text-2xl font-bold mb-6">Add Team Member</h2>
              <form onSubmit={handleUserSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={userForm.name}
                    onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="john@company.com"
                    value={userForm.email}
                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    placeholder="Create password"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={loading} className="flex-1 px-6 py-3 rounded-xl" style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})`, color: '#fff' }}>
                    {loading ? 'Adding...' : 'Add User'}
                  </button>
                  <button type="button" onClick={() => setShowUserForm(false)} className="px-6 py-3 rounded-xl" style={{ background: darkMode ? '#071024' : '#f1f5f9', color: theme.pageText }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Task Form Modal (admin only) */}
        {isAdmin && showTaskForm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div style={cardStyle} className="rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
              <form onSubmit={handleTaskSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">Task Title</label>
                  <input
                    type="text"
                    placeholder="Enter task title"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    placeholder="Describe the task in detail..."
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border"
                    style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    rows="4"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Assign To</label>
                    <select
                      value={taskForm.assignedTo}
                      onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border"
                      style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                      required
                    >
                      <option value="">Select team member</option>
                      {users.map(user => (
                        <option key={user._id} value={user._id}>{user.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border"
                      style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#fff', color: theme.pageText }}
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={loading} className="flex-1 px-6 py-3 rounded-xl" style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})`, color: '#fff' }}>
                    {loading ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
                  </button>
                  <button type="button" onClick={() => { setShowTaskForm(false); setEditingTask(null); }} className="px-6 py-3 rounded-xl" style={{ background: darkMode ? '#071024' : '#f1f5f9', color: theme.pageText }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div style={cardStyle} className="rounded-2xl shadow-sm p-6 border" >
            <div className="flex items-center justify-between">
              <div>
                <p style={mutedStyle} className="text-sm font-medium">Total Tasks</p>
                <p className="text-3xl font-bold mt-2">{tasks.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: darkMode ? '#051423' : '#e6f0ff' }}>
                <svg className="w-6 h-6" fill="none" stroke={darkMode ? '#66d2ff' : '#2563eb'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                </svg>
              </div>
            </div>
          </div>

          <div style={cardStyle} className="rounded-2xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p style={mutedStyle} className="text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold mt-2">{tasks.filter(t => t.status === 'pending').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: darkMode ? '#051423' : '#f1f5f9' }}>
                <svg className="w-6 h-6" fill="none" stroke={darkMode ? '#9aa9b8' : '#475569'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div style={cardStyle} className="rounded-2xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p style={mutedStyle} className="text-sm font-medium">In Progress</p>
                <p className="text-3xl font-bold mt-2">{tasks.filter(t => t.status === 'in-progress').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: darkMode ? '#1f1a10' : '#fff7ed' }}>
                <svg className="w-6 h-6" fill="none" stroke={darkMode ? '#fbbf24' : '#d97706'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div style={cardStyle} className="rounded-2xl shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p style={mutedStyle} className="text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold mt-2">{tasks.filter(t => t.status === 'completed').length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: darkMode ? '#052018' : '#ecfdf5' }}>
                <svg className="w-6 h-6" fill="none" stroke={darkMode ? '#34d399' : '#059669'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <div style={cardStyle} className="rounded-2xl shadow-sm border overflow-hidden">
          <div className="px-8 py-6 border-b" style={{ borderColor: theme.cardBorder }}>
            <h2 className="text-2xl font-bold">Task Board</h2>
            <p style={mutedStyle} className="text-sm mt-1">Manage and track all your team tasks</p>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: theme.accentFrom, borderTopColor: 'transparent' }}></div>
              <p style={mutedStyle} className="mt-4">Loading tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: darkMode ? '#071024' : '#f1f5f9' }}>
                <svg className="w-12 h-12" fill="none" stroke={darkMode ? '#6fbdf0' : '#94a3b8'} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">No tasks yet</h3>
              <p style={mutedStyle} className="mb-6">Create your first task to get started with task management</p>
              {isAdmin && (
                <button onClick={() => setShowTaskForm(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl" style={{ background: `linear-gradient(90deg, ${theme.accentFrom}, ${theme.accentTo})`, color: '#fff' }}>
                  Create First Task
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {tasks.map(task => (
                <div key={task._id} className="p-6 hover:bg-slate-50 transition-colors group" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                  <div className="flex items-start gap-4">
                    <div className={`w-1 h-full ${getStatusColor(task.status)} rounded-full flex-shrink-0`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="text-lg font-semibold group-hover:text-indigo-400 transition">{task.title}</h3>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* HISTORY BUTTON */}
                          <button
                            onClick={() => { setHistoryTask(task); setShowHistoryModal(true); }}
                            className="p-2 rounded-lg transition"
                            style={{ color: theme.pageText }}
                            title="View history"
                          >
                            🕒
                          </button>

                          {/* ADMIN: Edit/Delete */}
                          {isAdmin ? (
                            <>
                              <button onClick={() => editTask(task)} className="p-2 rounded-lg transition" title="Edit task">✏️</button>
                              <button onClick={() => deleteTask(task._id)} className="p-2 rounded-lg transition" title="Delete task">🗑️</button>
                            </>
                          ) : (
                            <div className="w-16" />
                          )}
                        </div>
                      </div>

                      <p className="text-slate-400 mb-4" style={{ color: theme.pageText }}>{task.description}</p>

                      {/* STATUS / ASSIGNEE / DATE */}
                      <div className="flex flex-wrap items-center gap-4 text-sm">

                        {/* status badge */}
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${getStatusBadgeColor(task.status)}`}>
                          {task.status === 'in-progress' ? 'In Progress' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>

                        {/* inline status control for member (only for their assigned tasks) */}
                        {!isAdmin && String(task.assignedTo?._id) === String(currentUserId) && (
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg"
                            style={{ background: darkMode ? '#071024' : '#fff', color: theme.pageText, border: `1px solid ${theme.cardBorder}` }}
                          >
                            <option value={task.status}>{task.status}</option>
                            {allowedMemberTransitions(task.status).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}

                        {/* admin inline status control (full) */}
                        {isAdmin && (
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task, e.target.value)}
                            className="px-2 py-1 text-xs rounded-lg"
                            style={{ background: darkMode ? '#071024' : '#fff', color: theme.pageText, border: `1px solid ${theme.cardBorder}` }}
                          >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        )}

                        {/* assigned to */}
                        <div className="flex items-center gap-2" style={{ color: theme.pageText }}>
                          👤 <span className="font-medium">{task.assignedTo?.name}</span>
                        </div>

                        {/* created at */}
                        <div className="flex items-center gap-2" style={{ color: theme.muted }}>
                          📅 <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* HISTORY MODAL */}
      {showHistoryModal && historyTask && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div style={cardStyle} className="rounded-2xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Task History</h2>

            {historyTask.history && historyTask.history.length > 0 ? (
              <div className="space-y-4">
                {historyTask.history.map((h, i) => (
                  <div key={i} className="border rounded-xl p-4" style={{ borderColor: theme.cardBorder, background: darkMode ? '#071024' : '#f8fafc' }}>
                    <p style={{ color: theme.pageText, fontWeight: 600 }}>{h.message}</p>
                    <p style={{ color: theme.muted, fontSize: 12, marginTop: 6 }}>{new Date(h.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={mutedStyle}>No history available.</p>
            )}

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowHistoryModal(false)} className="px-6 py-3 rounded-xl" style={{ background: darkMode ? '#071024' : '#f1f5f9', color: theme.pageText }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
