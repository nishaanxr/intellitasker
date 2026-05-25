import React, { useState, useEffect } from "react";
import axios from "axios";
import Login from "./Login";
import AIChatbot from "./AIChatbot";
import CalmMode from "./CalmMode";

const API_URL = "https://intellitasker.onrender.com/api";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  
  const [isCalmMode, setIsCalmMode] = useState(false);
  const [showSprintAnalytics, setShowSprintAnalytics] = useState(false);

  // 2FA State
  const [setup2FAData, setSetup2FAData] = useState(null);
  const [verify2FACode, setVerify2FACode] = useState("");
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

  // Modals state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('linear-dark');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Forms state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    status: 'pending',
    priority: 'medium',
    deadline: ''
  });
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'member'
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [commentText, setCommentText] = useState("");

  // Load user
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setCurrentUser(JSON.parse(saved));
  }, []);

  // Fetch data
  useEffect(() => {
    if (currentUser) {
      fetchTasks();
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Command Menu Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandMenuOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandMenuOpen(false);
      }
      if (e.key === 'c' && !isCommandMenuOpen && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        handleOpenTaskModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandMenuOpen]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/tasks`, {
        params: {
          userId: currentUser.id,
          role: currentUser.role,
          workspaceId: currentUser.workspaceId || currentUser.id
        }
      });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, {
        params: {
          workspaceId: currentUser.workspaceId || currentUser.id
        }
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setActiveTab("dashboard");
  };

  const handleSetup2FA = async () => {
    try {
      const res = await axios.post(`${API_URL}/users/${currentUser.id}/2fa/setup`);
      setSetup2FAData(res.data);
      setIs2FAModalOpen(true);
    } catch (err) {
      showToast("Error setting up 2FA", "error");
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users/${currentUser.id}/2fa/verify`, {
        token: verify2FACode
      });
      showToast("2FA Enabled successfully!", "success");
      setIs2FAModalOpen(false);
    } catch (err) {
      showToast("Invalid code, try again.", "error");
    }
  };

  // --- TASK OPERATIONS ---
  const handleOpenTaskModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description,
        assignedTo: task.assignedTo?._id || task.assignedTo,
        status: task.status,
        priority: task.priority || 'medium',
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '',
        description: '',
        assignedTo: '',
        status: 'pending',
        priority: 'medium',
        deadline: ''
      });
    }
    setIsTaskModalOpen(true);
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await axios.put(`${API_URL}/tasks/${editingTask._id}`, { ...taskForm, workspaceId: currentUser.workspaceId || currentUser.id });
      } else {
        await axios.post(`${API_URL}/tasks`, { ...taskForm, workspaceId: currentUser.workspaceId || currentUser.id });
      }
      setIsTaskModalOpen(false);
      fetchTasks();
    } catch (error) {
      alert("Error saving task: " + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await axios.delete(`${API_URL}/tasks/${id}`, { params: { userId: currentUser.id } });
      fetchTasks();
    } catch (error) {
      alert("Error deleting task: " + (error.response?.data?.error || error.message));
    }
  };

  const handleStatusChange = async (task, newStatus) => {
    // 1. Optimistic status update (Immediate visual movement)
    setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));

    try {
      // 2. Perform backend update quietly in the background
      const res = await axios.put(`${API_URL}/tasks/${task._id}`, { status: newStatus });
      
      // 3. Sync state with actual response
      setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
    } catch (error) {
      console.error("Error updating status", error);
      // Rollback if backend fails
      fetchTasks();
    }
  };

  const handleUpdateProgress = async (task, newHealthStatus, newBlockerText) => {
    // 1. Optimistic state update (Immediate frontend change)
    setTasks(prev => prev.map(t => t._id === task._id ? { 
      ...t, 
      healthStatus: newHealthStatus, 
      blockerText: newBlockerText 
    } : t));

    try {
      // 2. Perform backend update quietly in the background
      const res = await axios.put(`${API_URL}/tasks/${task._id}`, { healthStatus: newHealthStatus, blockerText: newBlockerText });
      
      // 3. Update the state with the actual populated database response
      setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
    } catch (error) {
      console.error("Error updating task metadata", error);
      // Rollback to original if API fails
      fetchTasks();
    }
  };

  const [isGeneratingAI, setIsGeneratingAI] = useState({});

  const handleAIBreakdown = async (task) => {
    try {
      setIsGeneratingAI(prev => ({...prev, [task._id]: true}));
      await axios.post(`${API_URL}/tasks/${task._id}/ai-breakdown`);
      fetchTasks();
    } catch (error) {
      alert("Error generating AI subtasks: " + error.message);
    } finally {
      setIsGeneratingAI(prev => ({...prev, [task._id]: false}));
    }
  };

  const handleToggleSubtask = async (task, subtaskIndex) => {
    try {
      const updatedSubtasks = [...task.subtasks];
      updatedSubtasks[subtaskIndex].completed = !updatedSubtasks[subtaskIndex].completed;
      await axios.put(`${API_URL}/tasks/${task._id}`, { subtasks: updatedSubtasks });
      fetchTasks();
    } catch (error) {
      console.error("Error toggling subtask", error);
    }
  };

  const handleFileUpload = async (task, e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API_URL}/tasks/${task._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchTasks();
      alert("File uploaded successfully!");
    } catch (error) {
      alert("Error uploading file: " + error.message);
    }
  };

  const onDragStart = (e, taskId) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e, status) => {
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find(t => t._id === taskId);
    if (task && task.status !== status) {
      handleStatusChange(task, status);
    }
  };

  // --- COMMENT OPERATIONS ---
  const openComments = (task) => {
    setSelectedTaskForComments(task);
    setIsCommentsOpen(true);
  };

  // Live Comments and History Sync Polling (every 3 seconds)
  useEffect(() => {
    if (!isCommentsOpen || !selectedTaskForComments) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/tasks`, {
          params: {
            userId: currentUser.id,
            role: currentUser.role,
            workspaceId: currentUser.workspaceId || currentUser.id
          }
        });
        const latestTasks = res.data;
        setTasks(latestTasks);
        
        const updatedSelected = latestTasks.find(t => t._id === selectedTaskForComments._id);
        if (updatedSelected && (
          JSON.stringify(updatedSelected.comments) !== JSON.stringify(selectedTaskForComments.comments) ||
          JSON.stringify(updatedSelected.history) !== JSON.stringify(selectedTaskForComments.history)
        )) {
          setSelectedTaskForComments(updatedSelected);
        }
      } catch (err) {
        console.error("Error polling live updates:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommentsOpen, selectedTaskForComments?._id, currentUser]);

  // J.A.R.V.I.S. AI Update Generator
  const handleAIDraftUpdate = async (type) => {
    setCommentText("J.A.R.V.I.S. is drafting your update...");
    try {
      let prompt = "";
      if (type === 'blocked') {
        prompt = `Write a extremely short, professional update for a task comment. The task is "${selectedTaskForComments.title}" (${selectedTaskForComments.description || ''}). I am currently BLOCKED or need help from the manager. Draft a message for me explaining this politely in 1-2 short sentences. Do not use quotes, introductory phrases, or placeholders.`;
      } else {
        prompt = `Write a extremely short, professional progress update for a task comment. The task is "${selectedTaskForComments.title}" (${selectedTaskForComments.description || ''}) and we are making progress. Draft a polite 1-2 sentence update for the team. Do not use quotes, introductory phrases, or placeholders.`;
      }

      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          userId: currentUser.id,
          name: currentUser.name
        })
      });
      const data = await response.json();
      if (data.reply) {
        setCommentText(data.reply);
      } else {
        setCommentText("Unable to generate draft.");
      }
    } catch (err) {
      console.error(err);
      setCommentText("Error generating draft.");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const res = await axios.post(`${API_URL}/tasks/${selectedTaskForComments._id}/comments`, {
        userId: currentUser.id,
        text: commentText
      });

      // Update local state to reflect new comment immediately
      const updatedTask = res.data;
      setTasks(prev => prev.map(t => t._id === updatedTask._id ? updatedTask : t));
      setSelectedTaskForComments(updatedTask);
      setCommentText("");
    } catch (error) {
      alert("Error adding comment: " + error.message);
    }
  };

  // --- USER OPERATIONS ---
  const handleOpenUserModal = () => {
    setUserForm({ name: '', email: '', role: 'member' });
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users`, { ...userForm, workspaceId: currentUser.workspaceId || currentUser.id });
      setIsUserModalOpen(false);
      setUserForm({ name: '', email: '', role: 'member' });
      fetchUsers();
      alert("User created successfully! An email with the password has been sent.");
    } catch (error) {
      alert("Error creating user: " + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await axios.delete(`${API_URL}/users/${userId}`);
      fetchUsers();
      fetchTasks(); // Refresh tasks to remove those assigned to the deleted user
    } catch (error) {
      alert("Error removing user: " + (error.response?.data?.error || error.message));
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("New passwords do not match");
      return;
    }

    try {
      await axios.put(`${API_URL}/users/${currentUser.id}/update-password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      alert("Password updated successfully!");
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      alert("Error updating password: " + (error.response?.data?.message || error.message));
    }
  };

  if (!currentUser) return <Login onLogin={setCurrentUser} />;

  const isAdmin = currentUser.role === 'admin';

  // --- FILTER & STATS CALCULATION ---
  const visibleTasks = tasks.filter(t => {
    const assignedId = String(t.assignedTo?._id || t.assignedTo || '');
    const currentUserId = String(currentUser.id || currentUser._id || '');
    
    if (!isAdmin) {
      // Non-admin users only see tasks assigned to them
      return assignedId === currentUserId;
    } else {
      // Admin sees all tasks unless filtering by a specific assignee
      if (filterAssignee !== 'all') {
        return assignedId === String(filterAssignee);
      }
      return true;
    }
  });

  const filteredTasks = visibleTasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const totalTasks = visibleTasks.length;
  const completedTasks = visibleTasks.filter(t => t.status === 'completed').length;
  const pendingTasks = visibleTasks.filter(t => t.status === 'pending' || t.status === 'in-progress').length;
  const urgentTasks = visibleTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length;


  const completedTasksList = visibleTasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const renderTaskCard = (task) => (
    <div 
      key={task._id} 
      draggable
      onDragStart={(e) => onDragStart(e, task._id)}
      onClick={() => openComments(task)}
      className={`group bg-[#151516] p-4 rounded-xl border ${task.blockerText && task.status !== 'completed' ? 'border-red-500/50 hover:border-red-500' : 'border-[#27272a] hover:border-[#3f3f46]'} shadow-sm transition-all cursor-grab active:cursor-grabbing mb-3`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-[#eeeeee] font-medium text-sm leading-tight group-hover:text-white transition-colors flex items-center gap-2">
          {task.title}
          {task.blockerText && task.status !== 'completed' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Blocked"></span>}
        </h4>
        <div className="flex gap-1 shrink-0 ml-2">
          {task.priority === 'high' && <span className="text-[10px] flex items-center gap-1 text-red-400"><div className="w-2 h-2 rounded-full bg-red-400"></div> High</span>}
          {task.priority === 'medium' && <span className="text-[10px] flex items-center gap-1 text-amber-400"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Med</span>}
          {task.priority === 'low' && <span className="text-[10px] flex items-center gap-1 text-[#8a8f98]"><div className="w-2 h-2 rounded-full bg-[#8a8f98]"></div> Low</span>}
        </div>
      </div>
      <p className="text-[#8a8f98] text-xs mb-3 line-clamp-2">{task.description}</p>
      
      {task.status === 'in-progress' && (
        <div className="mb-4 pt-2 border-t border-[#27272a]/50 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
          
          {/* AI Subtasks Section */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px] text-[#8a8f98] font-medium">
              <span>Action Plan</span>
              {task.subtasks && task.subtasks.length > 0 && (
                <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}</span>
              )}
            </div>
            
            {(!task.subtasks || task.subtasks.length === 0) ? (
              <button 
                onClick={(e) => { e.stopPropagation(); handleAIBreakdown(task); }}
                disabled={isGeneratingAI[task._id]}
                className="w-full py-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 flex items-center justify-center gap-1.5 text-[10px] font-medium transition-all"
              >
                {isGeneratingAI[task._id] ? (
                  <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
                {isGeneratingAI[task._id] ? 'AI Generating...' : 'AI: Generate Action Plan'}
              </button>
            ) : (
              <div className="flex flex-col gap-1.5">
                {task.subtasks.map((st, i) => (
                  <div key={i} className="flex items-start gap-2 group/st cursor-pointer" onClick={(e) => { e.stopPropagation(); handleToggleSubtask(task, i); }}>
                    <div className={`mt-0.5 w-3 h-3 rounded flex-shrink-0 border flex items-center justify-center transition-colors ${st.completed ? 'bg-purple-500 border-purple-500' : 'border-[#3f3f46] group-hover/st:border-purple-500/50'}`}>
                      {st.completed && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={`text-[10px] leading-tight ${st.completed ? 'text-[#8a8f98] line-through' : 'text-[#eeeeee]'}`}>{st.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Health Status & File Upload */}
          <div className="flex justify-between items-end">
            <div className="flex-1 mr-2">
              <div className="flex justify-between text-[10px] text-[#8a8f98] mb-1.5 font-medium">
                <span>Task Health</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUpdateProgress(task, 'on-track', task.blockerText); }} 
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${task.healthStatus === 'on-track' || !task.healthStatus ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-[#8a8f98] border-[#27272a] hover:border-[#3f3f46]'}`}
                >
                  On Track
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUpdateProgress(task, 'at-risk', task.blockerText); }} 
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${task.healthStatus === 'at-risk' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-transparent text-[#8a8f98] border-[#27272a] hover:border-[#3f3f46]'}`}
                >
                  At Risk
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleUpdateProgress(task, 'blocked', task.blockerText); }} 
                  className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${task.healthStatus === 'blocked' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-transparent text-[#8a8f98] border-[#27272a] hover:border-[#3f3f46]'}`}
                >
                  Blocked
                </button>
              </div>
            </div>
            
            <label className="shrink-0 w-8 h-8 rounded bg-[#27272a] hover:bg-[#3f3f46] flex items-center justify-center cursor-pointer transition-colors border border-[#3f3f46] text-[#8a8f98] hover:text-[#eeeeee] relative group/upload">
              <input type="file" className="hidden" onChange={(e) => handleFileUpload(task, e)} />
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#27272a] text-[#eeeeee] text-[10px] py-1 px-2 rounded opacity-0 group-hover/upload:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl border border-[#3f3f46]">
                Upload File / Code
              </div>
            </label>
          </div>

          {/* Last Update / Blockers */}
          <div className="flex items-center gap-2 mt-1">
            <input 
              type="text" 
              placeholder="Last Update / Blockers... (Press Enter to save)"
              defaultValue={task.blockerText || ""}
              onBlur={(e) => handleUpdateProgress(task, task.healthStatus || 'on-track', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="flex-1 bg-[#0e0e10] border border-[#27272a] focus:border-purple-500/50 rounded p-1.5 text-[10px] text-[#eeeeee] placeholder:text-[#8a8f98]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Display Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] text-[#8a8f98] font-medium">Uploaded Files</span>
              {task.attachments.map((file, i) => (
                <a key={i} href={`${API_URL}${file.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:underline bg-blue-500/10 px-2 py-1 rounded w-max border border-blue-500/20" onClick={(e) => e.stopPropagation()}>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  {file.originalName}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={`flex items-center justify-between mt-auto pt-3 ${task.status === 'in-progress' ? '' : 'border-t border-[#27272a]'}`}>
        <div className="flex items-center gap-2 text-xs">
           <div className="w-5 h-5 rounded-full bg-[#27272a] flex items-center justify-center text-[10px] font-medium text-[#eeeeee]" title={task.assignedTo?.name || 'Unassigned'}>
             {task.assignedTo?.name ? task.assignedTo.name.charAt(0).toUpperCase() : '?'}
           </div>
           {(() => {
             const deadlineDate = task.deadline 
               ? new Date(task.deadline) 
               : new Date(new Date(task.createdAt || Date.now()).getTime() + 3 * 24 * 60 * 60 * 1000);
             
             return (
               <span className="flex items-center gap-1 text-[10px] bg-[#1d1d1f] text-[#8a8f98] px-2 py-0.5 rounded-md border border-[#27272a]" title={`Due date & time: ${deadlineDate.toLocaleString()}`}>
                 <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span className="text-purple-300 font-medium">Due:</span>
                 <span>{deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
               </span>
             );
           })()}
           {task.comments?.length > 0 && (
             <span className="flex items-center gap-1 text-[#8a8f98] bg-[#1d1d1f] px-2 py-0.5 rounded-md border border-[#27272a] text-[10px]">
               <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
               {task.comments.length}
             </span>
           )}
        </div>
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAdmin && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleOpenTaskModal(task); }} className="text-[#8a8f98] hover:text-white transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task._id); }} className="text-[#8a8f98] hover:text-red-400 transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderKanbanColumn = (title, status, taskList, colorClass) => (
    <div 
      className="flex flex-col flex-1 min-w-0 md:min-w-[300px] h-auto md:h-[620px] bg-[#0e0e10] rounded-xl border border-[#27272a] overflow-hidden shadow-md"
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, status)}
    >
      <div className={`p-4 border-b border-[#27272a] flex justify-between items-center bg-[#151516]`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
          <h3 className="font-semibold text-[#eeeeee] text-sm">{title}</h3>
          <span className="text-[#8a8f98] text-xs ml-1">{taskList.length}</span>
        </div>
        {isAdmin && <button onClick={() => { setTaskForm({...taskForm, title: '', description: '', assignedTo: '', priority: 'medium', deadline: '', status}); setIsTaskModalOpen(true); }} className="text-[#8a8f98] hover:text-[#eeeeee] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg></button>}
      </div>
      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar min-h-[200px] flex flex-col bg-[#0e0e10]">
        {taskList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8a8f98] rounded-xl p-6 min-h-[100px]">
             <p className="text-xs">No tasks</p>
          </div>
        ) : (
          taskList.map(renderTaskCard)
        )}
        
        {isAdmin && (
          <button 
            onClick={() => { setTaskForm({...taskForm, title: '', description: '', assignedTo: '', priority: 'medium', deadline: '', status}); setIsTaskModalOpen(true); }}
            className="mt-2 w-full py-2 flex items-center justify-center gap-2 text-sm text-[#8a8f98] hover:text-[#eeeeee] hover:bg-[#1a1a1c] rounded-xl transition-colors border border-transparent"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            New task
          </button>
        )}
      </div>
    </div>
  );

  const renderCommandPalette = () => {
    if (!isCommandMenuOpen) return null;
    
    return (
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={() => setIsCommandMenuOpen(false)}>
        <div className="w-full max-w-[600px] bg-[#151516] border border-[#27272a] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
           <div className="flex items-center px-4 border-b border-[#27272a]">
              <svg className="w-5 h-5 text-[#8a8f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                autoFocus
                type="text"
                placeholder="Type a command or search tasks..."
                value={commandSearch}
                onChange={(e) => setCommandSearch(e.target.value)}
                className="flex-1 bg-transparent border-none px-4 py-4 text-[#eeeeee] focus:outline-none placeholder:text-[#8a8f98]"
              />
              <div className="px-2 py-1 bg-[#27272a] text-[#8a8f98] text-[10px] rounded font-medium">ESC</div>
           </div>
           <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
             {!commandSearch && (
               <>
                 <div className="px-3 py-2 text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">Quick Actions</div>
                 {isAdmin && (
                   <button onClick={() => { setIsCommandMenuOpen(false); handleOpenTaskModal(); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#27272a] text-[#eeeeee] flex items-center gap-3 text-sm transition-colors">
                      <svg className="w-4 h-4 text-[#8a8f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      Create new task <span className="ml-auto text-[10px] bg-[#27272a] px-1.5 py-0.5 rounded text-[#8a8f98]">C</span>
                   </button>
                 )}
                 <button onClick={() => { setIsCommandMenuOpen(false); setIsCalmMode(true); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#27272a] text-[#eeeeee] flex items-center gap-3 text-sm transition-colors">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                    Enter Calm Mode
                 </button>
                 <button onClick={() => { setIsCommandMenuOpen(false); setActiveTab('settings'); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-[#27272a] text-[#eeeeee] flex items-center gap-3 text-sm transition-colors">
                    <svg className="w-4 h-4 text-[#8a8f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Go to Settings
                 </button>
               </>
             )}
             
             {commandSearch && (
               <>
                 <div className="px-3 py-2 text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">Search Results</div>
                 {tasks.filter(t => t.title.toLowerCase().includes(commandSearch.toLowerCase())).length === 0 ? (
                    <div className="px-3 py-4 text-center text-[#8a8f98] text-sm">No tasks found.</div>
                 ) : (
                    tasks.filter(t => t.title.toLowerCase().includes(commandSearch.toLowerCase())).map(t => (
                      <button key={t._id} onClick={() => { setIsCommandMenuOpen(false); openComments(t); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#27272a] flex items-center justify-between group transition-colors">
                        <span className="text-sm text-[#eeeeee]">{t.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#27272a] text-[#8a8f98] opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                      </button>
                    ))
                 )}
               </>
             )}
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen text-[#eeeeee] font-sans overflow-hidden ${selectedTheme === 'oled' ? 'bg-black' : 'bg-[#0e0e10]'} ${selectedTheme === 'light' ? 'light-mode' : ''}`}>
      {selectedTheme === 'light' && (
        <style dangerouslySetInnerHTML={{__html: `
          .light-mode {
            background-color: #f9fafb !important;
            color: #111827 !important;
          }
          .light-mode .bg-\\[\\#0e0e10\\] { background-color: #f9fafb !important; }
          .light-mode .bg-\\[\\#151516\\] { background-color: #ffffff !important; }
          .light-mode .border-\\[\\#27272a\\] { border-color: #e5e7eb !important; }
          .light-mode .text-\\[\\#eeeeee\\] { color: #111827 !important; }
          .light-mode .text-\\[\\#8a8f98\\] { color: #6b7280 !important; }
          .light-mode .hover\\:bg-\\[\\#27272a\\]:hover { background-color: #f3f4f6 !important; }
          .light-mode .hover\\:text-\\[\\#eeeeee\\]:hover { color: #111827 !important; }
          .light-mode .glass-panel { background: #ffffff !important; border-color: #e5e7eb !important; }
        `}} />
      )}
      
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] bg-[#151516] border border-[#27272a] text-[#eeeeee] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-[slide-up_0.3s_ease-out]">
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
          ) : toast.type === 'error' ? (
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
      {renderCommandPalette()}
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#151516] border-r border-[#27272a] flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">IntelliTasker</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
            label="Dashboard"
            isActive={activeTab === 'dashboard'}
            onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          />
          {isAdmin && (
            <NavItem
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              label="Admin Overview"
              isActive={activeTab === 'admin'}
              onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
            />
          )}
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
            label="Team Members"
            isActive={activeTab === 'users'}
            onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="Task History"
            isActive={activeTab === 'history'}
            onClick={() => { setActiveTab('history'); setIsMobileMenuOpen(false); }}
          />
          <NavItem
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            label="Settings"
            isActive={activeTab === 'settings'}
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
          />
        </nav>

        <div className="p-4 border-t border-[#27272a]">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-[#27272a] flex items-center justify-center text-sm font-bold text-[#eeeeee]">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#eeeeee] truncate">{currentUser.name}</p>
              <p className="text-xs text-[#8a8f98] truncate capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
               showToast("Logging out...", "info");
               setTimeout(handleLogout, 1000);
            }}
            className="w-full py-2 px-4 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-[#8a8f98] text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto relative ${selectedTheme === 'oled' ? 'bg-black' : 'bg-[#0e0e10]'}`}>


        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 relative z-10">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 rounded-lg bg-[#151516] border border-[#27272a] text-[#8a8f98] hover:text-[#eeeeee]"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[#eeeeee] tracking-tight">
                    {activeTab === 'dashboard' ? 'Tasks' : activeTab === 'admin' ? 'Admin Overview' : activeTab === 'users' ? 'Team Management' : activeTab === 'history' ? 'Activity Log' : 'Account Settings'}
                  </h1>
                  {activeTab === 'dashboard' && (
                    <button onClick={() => setIsCommandMenuOpen(true)} className="hidden md:flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-[#151516] border border-[#27272a] rounded-md text-[#8a8f98] hover:text-[#eeeeee] hover:border-[#3f3f46] transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      Ctrl+K
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeTab === 'dashboard' && (
                <>
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8f98]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      placeholder="Search tasks..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-1.5 bg-[#151516] border border-[#27272a] rounded-lg text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] placeholder:text-[#8a8f98] w-48 md:w-64"
                    />
                  </div>
                  <select 
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="px-3 py-1.5 bg-[#151516] border border-[#27272a] rounded-lg text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46]"
                  >
                    <option value="all">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  {isAdmin && (
                    <select 
                      value={filterAssignee}
                      onChange={(e) => setFilterAssignee(e.target.value)}
                      className="px-3 py-1.5 bg-[#151516] border border-[#27272a] rounded-lg text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46]"
                    >
                      <option value="all">All Members</option>
                      {users.map(user => (
                        <option key={user._id} value={user._id}>{user.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex bg-[#151516] border border-[#27272a] rounded-lg overflow-hidden p-0.5">
                    <button 
                      onClick={() => setViewMode('board')} 
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'board' ? 'bg-[#27272a] text-[#eeeeee]' : 'text-[#8a8f98] hover:text-[#eeeeee]'}`}
                    >
                      Board
                    </button>
                    <button 
                      onClick={() => setViewMode('list')} 
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-[#27272a] text-[#eeeeee]' : 'text-[#8a8f98] hover:text-[#eeeeee]'}`}
                    >
                      List
                    </button>
                  </div>
                  <button
                    onClick={() => setIsCalmMode(true)}
                    className="group relative px-3 py-1.5 bg-[#151516] border border-[#27272a] rounded-lg hover:border-purple-500/30 transition-all flex items-center gap-2 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="flex items-end gap-[2px] h-3 w-3 relative z-10">
                      <div className="w-[2px] bg-purple-400 h-1 group-hover:animate-[bounce_1s_infinite_0ms] rounded-full" />
                      <div className="w-[2px] bg-indigo-400 h-2.5 group-hover:animate-[bounce_1s_infinite_200ms] rounded-full" />
                      <div className="w-[2px] bg-purple-400 h-1.5 group-hover:animate-[bounce_1s_infinite_400ms] rounded-full" />
                    </div>
                    <span className="text-sm font-medium text-[#8a8f98] group-hover:text-[#eeeeee] transition-colors relative z-10">Lo-Fi Focus</span>
                  </button>
                  <button
                    onClick={() => setShowSprintAnalytics(!showSprintAnalytics)}
                    className={`px-3 py-1.5 border rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${showSprintAnalytics ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-semibold' : 'bg-[#151516] border-[#27272a] text-[#8a8f98] hover:text-[#eeeeee]'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    Sprint Stats
                  </button>
                </>
              )}
              {isAdmin && activeTab === 'dashboard' && (
                <button
                  onClick={() => handleOpenTaskModal()}
                  className="px-4 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  New Issue
                </button>
              )}
            </div>
          </header>

          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col min-h-full gap-6 pb-12">
              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 flex-shrink-0">
                <StatCard
                  title="Total Tasks"
                  value={totalTasks}
                  icon={<svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg>}
                  color="blue"
                />
                <StatCard
                  title="Completed"
                  value={completedTasks}
                  icon={<svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  color="emerald"
                />
                <StatCard
                  title="Pending"
                  value={pendingTasks}
                  icon={<svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  color="amber"
                />
                <StatCard
                  title="Urgent"
                  value={urgentTasks}
                  icon={<svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  color="red"
                />
              </div>

              {showSprintAnalytics && (
                <div className="bg-[#151516] border border-purple-500/20 rounded-xl p-6 flex flex-col lg:flex-row gap-8 items-stretch shadow-lg animate-fadeIn flex-shrink-0">
                  {/* Left Column: Progress Meter & Velocity */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[#eeeeee] font-semibold text-sm">Sprint Completion & Velocity</h4>
                        <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full font-medium border border-purple-500/20">Active Agile Sprint</span>
                      </div>
                      <p className="text-xs text-[#8a8f98] mb-3">Real-time status tracking using agile completion models and velocity measurements.</p>
                    </div>

                    {/* Sprint Metrics Badges */}
                    <div className="grid grid-cols-3 gap-3 my-3 bg-[#1d1d1f]/40 p-3 rounded-lg border border-[#27272a]/60">
                      <div className="text-center">
                        <div className="text-[10px] text-[#8a8f98] font-medium uppercase tracking-wider">Completed</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">{completedTasks} Tasks</div>
                        <div className="text-[8px] text-[#8a8f98]">{completedTasks * 3} SP</div>
                      </div>
                      <div className="text-center border-x border-[#27272a]/80">
                        <div className="text-[10px] text-[#8a8f98] font-medium uppercase tracking-wider">Remaining</div>
                        <div className="text-sm font-bold text-amber-400 mt-0.5">{pendingTasks} Tasks</div>
                        <div className="text-[8px] text-[#8a8f98]">{pendingTasks * 3} SP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-[#8a8f98] font-medium uppercase tracking-wider">Sprint Time</div>
                        <div className="text-sm font-bold text-purple-400 mt-0.5">3 Days Left</div>
                        <div className="text-[8px] text-[#8a8f98]">Day 11 of 14</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 my-2">
                      {/* Radial Progress indicator */}
                      <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path
                            className="text-slate-800"
                            strokeWidth="3.5"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="text-purple-500 transition-all duration-1000 ease-out"
                            strokeDasharray={`${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}, 100`}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-sm font-bold text-[#eeeeee]">
                            {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                          </span>
                          <span className="text-[8px] text-[#8a8f98] font-medium uppercase tracking-wider">Done</span>
                        </div>
                      </div>

                      {/* Velocity and Health text stats */}
                      <div className="flex-1 flex flex-col gap-3">
                        <div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#8a8f98] font-medium">Agile Velocity Score:</span>
                            <span className="font-bold text-purple-400">{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0} pts</span>
                          </div>
                          <div className="text-[9px] text-[#8a8f98] mt-0.5">Measures sprint commitment delivery speed. (Target: 80+)</div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#8a8f98] font-medium">Sprint Health Rating:</span>
                            <span className={`font-bold ${
                              visibleTasks.some(t => t.healthStatus === 'blocked' && t.status !== 'completed') ? 'text-red-400' :
                              visibleTasks.some(t => t.healthStatus === 'at-risk' && t.status !== 'completed') ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              {visibleTasks.some(t => t.healthStatus === 'blocked' && t.status !== 'completed') ? 'Critical (Blockers Found)' :
                               visibleTasks.some(t => t.healthStatus === 'at-risk' && t.status !== 'completed') ? 'At Risk (Action Needed)' : 'Optimal (On Track)'}
                            </span>
                          </div>
                          <div className="text-[9px] text-[#8a8f98] mt-0.5">
                            {visibleTasks.some(t => t.healthStatus === 'blocked' && t.status !== 'completed') ? '1 or more critical blockers need admin intervention.' :
                             visibleTasks.some(t => t.healthStatus === 'at-risk' && t.status !== 'completed') ? 'Sprint is slightly delayed. Monitor blockers.' : 'All tasks are proceeding smoothly.'}
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#8a8f98] font-medium">Collaborating Engineers:</span>
                            <span className="font-semibold text-[#eeeeee]">{users.length} Active Devs</span>
                          </div>
                          <div className="text-[9px] text-[#8a8f98] mt-0.5">Assigned workloads from active workspace database.</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#27272a]/50 text-[10px] text-[#8a8f98]">
                      {visibleTasks.some(t => t.healthStatus === 'blocked' && t.status !== 'completed') ? (
                        <div className="flex items-center gap-1.5 text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
                          <span>Alert: Blocked items are impeding sprint progress. Review active logs below!</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>All modules on track. Sprint velocity is stable.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Burndown Simulation SVG */}
                  <div className="flex-1 lg:border-l lg:border-[#27272a]/50 lg:pl-8 flex flex-col justify-between min-h-[180px]">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-[#eeeeee] font-semibold text-sm">Sprint Burndown Trend</h4>
                      <span className="text-[9px] text-[#8a8f98]">Story Points remaining over time</span>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center py-2">
                      <svg className="w-full h-full min-h-[120px] overflow-visible" viewBox="0 0 100 40">
                        {/* Grid lines */}
                        <line x1="0" y1="0" x2="100" y2="0" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2,2" />
                        <line x1="0" y1="20" x2="100" y2="20" stroke="#27272a" strokeWidth="0.5" strokeDasharray="2,2" />
                        <line x1="0" y1="40" x2="100" y2="40" stroke="#27272a" strokeWidth="0.5" />
                        <line x1="0" y1="0" x2="0" y2="40" stroke="#27272a" strokeWidth="0.5" />
                        <line x1="100" y1="0" x2="100" y2="40" stroke="#27272a" strokeWidth="0.5" />

                        {/* Ideal Burndown Line */}
                        <line x1="0" y1="2" x2="100" y2="38" stroke="#3b82f6" strokeWidth="1" strokeDasharray="1.5,1.5" />

                        {/* Actual Burndown Line (dynamic remaining work slope) */}
                        {/* Remaining work starts at TOP (y=2) and burns down to bottom right (y=2+36*ratio) */}
                        <path
                          d={`M 0 2 L 25 ${2 + 36 * (totalTasks > 0 ? (completedTasks / totalTasks) : 0) * 0.25} L 50 ${2 + 36 * (totalTasks > 0 ? (completedTasks / totalTasks) : 0) * 0.55} L 75 ${2 + 36 * (totalTasks > 0 ? (completedTasks / totalTasks) : 0) * 0.75} L 100 ${2 + 36 * (totalTasks > 0 ? (completedTasks / totalTasks) : 0)}`}
                          fill="none"
                          stroke="#a855f7"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />

                        {/* Legend text */}
                        <text x="5" y="36" fill="#3b82f6" fontSize="3" className="font-semibold">-- Ideal Sprint Burndown</text>
                        <text x="50" y="36" fill="#a855f7" fontSize="3" className="font-semibold">— Actual Story Point Burndown</text>
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-[#8a8f98] pt-1">
                      <span>Day 1 (Kickoff)</span>
                      <span>Day 7 (Midway)</span>
                      <span>Day 14 (Review)</span>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'board' ? (
                /* Kanban Board Container */
                <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 pb-4 items-stretch relative min-h-0 md:overflow-x-auto md:pb-6">
                   {loading ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#eeeeee]"></div>
                      </div>
                   ) : (
                      <>
                        {renderKanbanColumn('To Do', 'pending', filteredTasks.filter(t => t.status === 'pending'), 'bg-[#8a8f98]')}
                        {renderKanbanColumn('In Progress', 'in-progress', filteredTasks.filter(t => t.status === 'in-progress'), 'bg-amber-400')}
                        {renderKanbanColumn('Done', 'completed', filteredTasks.filter(t => t.status === 'completed'), 'bg-emerald-500')}
                      </>
                   )}
                </div>
              ) : (
                /* List View */
                <div className="flex-1 bg-[#151516] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
                  <div className="grid grid-cols-12 gap-4 p-4 border-b border-[#27272a] text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">
                     <div className="col-span-6 md:col-span-5">Task</div>
                     <div className="col-span-3 md:col-span-2">Status</div>
                     <div className="col-span-3 md:col-span-2">Priority</div>
                     <div className="hidden md:block md:col-span-3">Assignee</div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                     {loading ? (
                       <div className="flex justify-center items-center h-32 text-[#8a8f98]">Loading...</div>
                     ) : filteredTasks.length === 0 ? (
                       <div className="flex justify-center items-center h-32 text-[#8a8f98]">No tasks found.</div>
                     ) : (
                       filteredTasks.map(task => (
                         <div key={task._id} onClick={() => openComments(task)} className="grid grid-cols-12 gap-4 p-3 hover:bg-[#27272a]/50 rounded-lg cursor-pointer items-center text-sm border-b border-[#27272a]/50 last:border-0 group transition-colors">
                            <div className="col-span-6 md:col-span-5 font-medium text-[#eeeeee] flex flex-col">
                               <span>{task.title}</span>
                               {(() => {
                                 const deadlineDate = task.deadline 
                                   ? new Date(task.deadline) 
                                   : new Date(new Date(task.createdAt || Date.now()).getTime() + 3 * 24 * 60 * 60 * 1000);
                                 
                                 return (
                                   <span className="text-[10px] text-[#8a8f98] mt-0.5">
                                     Due: {deadlineDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                   </span>
                                 );
                               })()}
                            </div>
                            <div className="col-span-3 md:col-span-2">
                               <select
                                  onClick={(e) => e.stopPropagation()}
                                  value={task.status}
                                  onChange={(e) => handleStatusChange(task, e.target.value)}
                                  className="bg-transparent border border-[#27272a] text-xs rounded px-2 py-1 focus:outline-none focus:border-[#3f3f46] text-[#eeeeee]"
                               >
                                  <option value="pending">To Do</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="completed">Done</option>
                               </select>
                            </div>
                            <div className="col-span-3 md:col-span-2 flex items-center">
                               {task.priority === 'high' && <span className="text-red-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> High</span>}
                               {task.priority === 'medium' && <span className="text-amber-400 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Medium</span>}
                               {task.priority === 'low' && <span className="text-[#8a8f98] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#8a8f98]"></div> Low</span>}
                            </div>
                            <div className="hidden md:flex md:col-span-3 items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-[#27272a] flex items-center justify-center text-[10px] font-medium text-[#eeeeee]">
                                    {task.assignedTo?.name ? task.assignedTo.name.charAt(0).toUpperCase() : '?'}
                                  </div>
                                  <span className="text-[#8a8f98] text-xs">{task.assignedTo?.name || 'Unassigned'}</span>
                               </div>
                               {isAdmin && (
                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenTaskModal(task); }} className="text-[#8a8f98] hover:text-white"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task._id); }} className="text-[#8a8f98] hover:text-red-400"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                  </div>
                               )}
                            </div>
                         </div>
                       ))
                     )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-2">
                <h3 className="text-lg font-semibold text-[#eeeeee]">General</h3>
                <p className="text-sm text-[#8a8f98]">Manage your account settings and preferences.</p>
              </div>
              <div className="md:col-span-2 space-y-6">
                <div className="bg-[#151516] border border-[#27272a] rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-[#eeeeee] mb-4">Change Password</h4>
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full bg-[#0e0e10] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="password"
                        placeholder="New Password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full bg-[#0e0e10] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors"
                        required
                      />
                      <input
                        type="password"
                        placeholder="Confirm Password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full bg-[#0e0e10] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-[#eeeeee] focus:outline-none focus:border-[#3f3f46] transition-colors"
                        required
                      />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors">
                      Update Password
                    </button>
                  </form>
                </div>

                <div className="bg-[#151516] border border-[#27272a] rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-[#eeeeee] mb-1">Theme Preferences</h4>
                  <p className="text-xs text-[#8a8f98] mb-4">Select your default workspace theme.</p>
                  <div className="flex gap-4">
                    <button onClick={() => { setSelectedTheme('linear-dark'); showToast("Linear Dark theme applied.", "success"); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTheme === 'linear-dark' ? 'border-2 border-white bg-[#0e0e10] text-[#eeeeee]' : 'border border-[#27272a] bg-[#151516] text-[#8a8f98] hover:text-[#eeeeee]'}`}>Linear Dark</button>
                    <button onClick={() => { setSelectedTheme('light'); showToast("Light Mode applied.", "success"); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTheme === 'light' ? 'border-2 border-black bg-white text-black' : 'border border-[#27272a] bg-[#151516] text-[#8a8f98] hover:text-[#eeeeee]'}`}>Light Mode</button>
                    <button onClick={() => { setSelectedTheme('oled'); showToast("OLED Black theme applied.", "success"); }} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${selectedTheme === 'oled' ? 'border-2 border-white bg-[#000000] text-[#eeeeee]' : 'border border-[#27272a] bg-[#000000] text-[#8a8f98] hover:text-[#eeeeee]'}`}>OLED Black</button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 space-y-2 mt-4">
                <h3 className="text-lg font-semibold text-[#eeeeee]">Security & Integrations</h3>
                <p className="text-sm text-[#8a8f98]">Connect tools and secure your account.</p>
              </div>
              <div className="md:col-span-2 space-y-6 mt-4">
                <div className="bg-[#151516] border border-[#27272a] rounded-xl p-6 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-semibold text-[#eeeeee]">Two-Factor Authentication</h4>
                    <p className="text-xs text-[#8a8f98] mt-1">Add an extra layer of security to your account.</p>
                  </div>
                  <button onClick={handleSetup2FA} className="px-4 py-2 bg-[#27272a] text-[#eeeeee] text-sm font-medium rounded-lg hover:bg-[#3f3f46] transition-colors">Enable 2FA</button>
                </div>
                
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6">
                  <h4 className="text-sm font-semibold text-red-400">Danger Zone</h4>
                  <p className="text-xs text-red-400/70 mt-1 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                  <button onClick={async () => {
                     if (window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
                        try {
                           await axios.delete(`${API_URL}/users/${currentUser.id}`);
                           showToast("Account deleted successfully.", "success");
                           setTimeout(handleLogout, 1500);
                        } catch (error) {
                           alert("Error deleting account: " + (error.response?.data?.error || error.message));
                        }
                     }
                  }} className="px-4 py-2 bg-red-500/10 text-red-500 text-sm font-medium border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Delete Account</button>
                </div>
              </div>
            </div>
          )}

          {/* ADMIN OVERVIEW TAB */}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6 max-w-6xl mx-auto animate-[fade-in_0.3s_ease-out]">
              <div className="bg-[#151516] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-[#27272a] bg-[#1a1a1c] flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#eeeeee]">Admin Dashboard Shows:</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#27272a] bg-[#151516] text-[#8a8f98] text-xs font-semibold uppercase tracking-wider">
                        <th className="p-4">Task</th>
                        <th className="p-4">User</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Progress</th>
                        <th className="p-4">Last Update</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a] text-sm">
                      {tasks.map(task => {
                        let progressText = '-';
                        if (task.status === 'completed') {
                          progressText = '100%';
                        } else if (task.subtasks && task.subtasks.length > 0) {
                          const completed = task.subtasks.filter(s => s.completed).length;
                          progressText = `${Math.round((completed / task.subtasks.length) * 100)}%`;
                        } else if (task.status === 'in-progress') {
                          progressText = task.healthStatus === 'on-track' ? 'On Track' : task.healthStatus === 'at-risk' ? 'At Risk' : 'Blocked';
                        }
                        
                        return (
                          <tr key={task._id} className="hover:bg-[#1a1a1c] transition-colors group cursor-pointer" onClick={() => openComments(task)}>
                            <td className="p-4 text-[#eeeeee] font-medium max-w-[200px] truncate">{task.title}</td>
                            <td className="p-4 text-[#8a8f98]">{task.assignedTo?.name || 'Unassigned'}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                                task.status === 'in-progress' ? 'bg-blue-500/10 text-blue-400' :
                                'bg-[#27272a] text-[#8a8f98]'
                              }`}>
                                {task.status === 'in-progress' ? 'In Progress' : task.status === 'completed' ? 'Completed' : 'To Do'}
                              </span>
                            </td>
                            <td className="p-4 text-[#eeeeee]">{progressText}</td>
                            <td className="p-4 text-[#8a8f98] max-w-[250px] truncate">
                              {task.blockerText || (task.history && task.history.length > 0 ? task.history[task.history.length - 1].message : 'No updates')}
                            </td>
                          </tr>
                        );
                      })}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan="5" className="p-8 text-center text-[#8a8f98]">No tasks found on the board.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TEAM MEMBERS TAB */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {users.map(user => (
                  <div key={user._id} className="bg-[#151516] border border-[#27272a] rounded-xl p-5 flex flex-col relative group">
                    {user._id === currentUser.id && <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">You</span>}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center text-lg font-medium text-[#eeeeee]">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#151516] rounded-full"></div>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[#eeeeee]">{user.name}</h3>
                        <p className="text-xs text-[#8a8f98]">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#27272a]">
                      <span className={`px-2 py-1 rounded text-[10px] font-medium capitalize ${user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-[#27272a] text-[#8a8f98]'}`}>
                        {user.role}
                      </span>
                      {isAdmin && user._id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          className="text-[#8a8f98] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove Member"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isAdmin && (
                  <button onClick={handleOpenUserModal} className="bg-transparent border border-dashed border-[#3f3f46] rounded-xl p-5 flex flex-col items-center justify-center text-[#8a8f98] hover:border-[#8a8f98] hover:text-[#eeeeee] transition-all min-h-[160px]">
                    <svg className="w-8 h-8 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    <span className="text-sm font-medium">Invite new member</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* HISTORY VIEW */}
          {activeTab === 'history' && (
            <div className="max-w-3xl">
              <div className="relative pl-8 space-y-8 before:absolute before:inset-y-0 before:left-[11px] before:w-px before:bg-[#27272a]">
                {completedTasksList.length === 0 ? (
                  <div className="text-[#8a8f98] text-sm py-8">No completed tasks in history yet.</div>
                ) : (
                  completedTasksList.map((task) => (
                    <div key={task._id} className="relative group">
                      <div className="absolute -left-10 top-1 w-6 h-6 rounded-full bg-[#151516] border-2 border-[#27272a] flex items-center justify-center group-hover:border-emerald-500 transition-colors z-10">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      </div>
                      <div className="bg-[#151516] border border-[#27272a] rounded-xl p-5 hover:border-[#3f3f46] transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-sm font-semibold text-[#eeeeee]">{task.title}</h4>
                          <span className="text-[10px] text-[#8a8f98]">{new Date(task.updatedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-[#8a8f98] mb-4">{task.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-[#0e0e10] border border-[#27272a] px-2 py-1 rounded-md text-[10px] text-[#8a8f98]">
                            <div className="w-3.5 h-3.5 rounded-full bg-[#27272a] flex items-center justify-center font-bold text-[#eeeeee]">
                              {task.assignedTo?.name ? task.assignedTo.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            Completed by {task.assignedTo?.name || 'Unknown'}
                          </div>
                          {task.priority === 'high' && <span className="text-red-400 text-[10px] font-medium flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> High Priority</span>}
                          {task.priority === 'medium' && <span className="text-amber-400 text-[10px] font-medium flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> Medium Priority</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* COMMENTS MODAL */}
      {isCommentsOpen && selectedTaskForComments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg h-[600px] flex flex-col bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden glass-panel">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedTaskForComments.title}</h3>
                <p className="text-sm text-slate-400">Comments & Discussion</p>
              </div>
              <button onClick={() => setIsCommentsOpen(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {(() => {
                const combined = [
                  ...(selectedTaskForComments.comments || []).map(c => ({ ...c, type: 'comment' })),
                  ...(selectedTaskForComments.history || []).map(h => ({ ...h, type: 'history' }))
                ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                return combined.length > 0 ? (
                  combined.map((item, idx) => {
                    if (item.type === 'history') {
                      return (
                        <div key={`h-${idx}`} className="flex justify-center my-2 animate-[fade-in_0.2s_ease-out]">
                          <span className="bg-[#1e293b]/70 text-slate-400 border border-slate-700/40 text-[10px] px-3 py-1 rounded-full text-center tracking-wide font-medium shadow-sm">
                            ⚙️ {item.message}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={`c-${idx}`} className={`flex gap-3 animate-[fade-in_0.2s_ease-out] ${item.user?._id === currentUser.id ? 'justify-end' : ''}`}>
                        {item.user?._id !== currentUser.id && (
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {item.user?.name ? item.user.name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl p-3 text-sm ${item.user?._id === currentUser.id ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30 rounded-tr-none' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-semibold text-xs ${item.user?._id === currentUser.id ? 'text-blue-400' : 'text-slate-400'}`}>
                              {item.user?._id === currentUser.id ? 'You' : item.user?.name}
                            </span>
                            <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p>{item.text}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                    <svg className="w-12 h-12 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    <p>No activity or comments yet. Start the conversation!</p>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 space-y-3">
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-400 font-medium flex items-center gap-1">✨ J.A.R.V.I.S. Drafter:</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleAIDraftUpdate('progress')} 
                    type="button"
                    className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] transition-all cursor-pointer font-semibold"
                  >
                    Draft Progress Update
                  </button>
                  <button 
                    onClick={() => handleAIDraftUpdate('blocked')} 
                    type="button"
                    className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[10px] transition-all cursor-pointer font-semibold"
                  >
                    Draft Blocker Alert
                  </button>
                </div>
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Type a message..."
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || commentText.startsWith("J.A.R.V.I.S. is drafting")}
                  className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
                >
                  <svg className="w-5 h-5 block" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden glass-panel">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleTaskSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="e.g. Update Homepage Design"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                <textarea
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors h-24 resize-none"
                  placeholder="Task details..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Assign To</label>
                  <select
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    required
                  >
                    <option value="">Select Member</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Deadline</label>
                  <input
                    type="datetime-local"
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-600/20">{editingTask ? 'Save Changes' : 'Create Task'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {is2FAModalOpen && setup2FAData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden glass-panel">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white">Setup Two-Factor Authentication</h3>
              <button onClick={() => setIs2FAModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 flex flex-col items-center">
              <p className="text-sm text-slate-400 text-center mb-4">
                1. Scan this QR Code using Google Authenticator or Authy.
              </p>
              <div className="p-2 bg-white rounded-xl mb-4">
                <img src={setup2FAData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-slate-500 mb-6 font-mono text-center break-all">
                Or manually enter this secret: <br/> <strong className="text-slate-300">{setup2FAData.secret}</strong>
              </p>

              <form onSubmit={handleVerify2FA} className="w-full space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">2. Enter the 6-digit code</label>
                  <input
                    type="text"
                    value={verify2FACode}
                    onChange={(e) => setVerify2FACode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center tracking-widest text-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="000000"
                    maxLength={6}
                    required
                  />
                </div>
                <button type="submit" className="w-full px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition shadow-lg shadow-blue-600/20 font-medium">
                  Verify & Enable 2FA
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden glass-panel">
            <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white">Add New Member</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4" autoComplete="off">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Name"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                  placeholder="Email"
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition shadow-lg shadow-purple-600/20">Add User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCalmMode && (
        <CalmMode
          tasks={visibleTasks}
          onExit={() => setIsCalmMode(false)}
          onTaskStatusChange={handleStatusChange}
        />
      )}

      {/* Floating Chatbot */}
      <AIChatbot />
    </div>
  );
}

// Sub-components
const NavItem = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
      ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
  >
    {icon}
    {label}
  </button>
);

const StatCard = ({ title, value, icon, color }) => {
  const colorStyles = {
    blue: "from-blue-500/20 to-indigo-500/5 text-blue-400",
    emerald: "from-emerald-500/20 to-teal-500/5 text-emerald-400",
    amber: "from-amber-500/20 to-orange-500/5 text-amber-400",
    red: "from-red-500/20 to-pink-500/5 text-red-400"
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-700/30 relative overflow-hidden group hover:border-slate-600/50 transition-colors">
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${colorStyles[color]} blur-2xl group-hover:scale-150 transition-transform duration-500`}></div>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-slate-400 text-sm font-medium">{title}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
          </div>
          <div className={`p-2 rounded-lg bg-slate-800/50 ${colorStyles[color].split(" ")[2]}`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
};



export default App;
