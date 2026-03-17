const { useState, useEffect, useMemo } = React;
const { 
  Users, CalendarPlus, List, CalendarMinus, PieChart, 
  Plus, UserPlus, Calendar, Info, CheckCircle2, XCircle, AlertCircle, Search, Trash2
} = LucideReact;

function App() {
  // --- State Management ---
  // --- Authentication State ---
  const [token, setToken] = useState(localStorage.getItem('altLeaves_token') || null);
  const [userRole, setUserRole] = useState(localStorage.getItem('altLeaves_role') || null);
  const [username, setUsername] = useState(localStorage.getItem('altLeaves_username') || null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Admin Create User State
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '' });
  const [adminMessage, setAdminMessage] = useState('');

  // --- Data State Management ---
  const [employees, setEmployees] = useState([]);
  const [earnedLeaves, setEarnedLeaves] = useState([]);
  const [takenLeaves, setTakenLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const API_URL = '/api'; // Using relative path for production and local serving

  // Initial Fetch Data
  useEffect(() => {
    const fetchData = async () => {
        try {
            const response = await fetch(`${API_URL}/data`);
            if (response.ok) {
                const data = await response.json();
                setEmployees(data.employees || []);
                setEarnedLeaves(data.earnedLeaves || []);
                setTakenLeaves(data.takenLeaves || []);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, []);

  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpCustomId, setNewEmpCustomId] = useState('');
  const [newEmpDesignation, setNewEmpDesignation] = useState('');
  const [newEmpTeam, setNewEmpTeam] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  
  // Default to current month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  // Forms State
  const [earnedDate, setEarnedDate] = useState('');
  const [earnedReason, setEarnedReason] = useState('');
  
  const [takenDate, setTakenDate] = useState('');
  const [takenRefId, setTakenRefId] = useState('');

  // --- Persistence to Backend ---
  // Syncs data whenever token or data changes, IF logged in.
  useEffect(() => {
    if (!token || isLoading) return;
    
    // We only want to sync when the user explicitly triggers an action,
    // but a simple automatic sync after state change works for this app scale.
    // Skip initial empty states to prevent overwriting backend.
  }, [employees, earnedLeaves, takenLeaves, token, isLoading]);

  const syncToBackend = async (newEmployees, newEarned, newTaken) => {
      if (!token) return;
      try {
          await fetch(`${API_URL}/data`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                  employees: newEmployees || employees, 
                  earnedLeaves: newEarned || earnedLeaves, 
                  takenLeaves: newTaken || takenLeaves
              })
          });
      } catch (error) {
          console.error("Sync failed", error);
      }
  };

  // --- Auth Handlers ---
  const handleLogin = async (e) => {
      e.preventDefault();
      setLoginError('');
      try {
         const res = await fetch(`${API_URL}/login`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(loginForm)
         });
         const data = await res.json();
         if (res.ok) {
             setToken(data.token);
             setUserRole(data.role);
             setUsername(data.username);
             localStorage.setItem('altLeaves_token', data.token);
             localStorage.setItem('altLeaves_role', data.role);
             localStorage.setItem('altLeaves_username', data.username);
             setShowLogin(false);
             setLoginForm({username: '', password: ''});
         } else {
             setLoginError(data.error || 'Login failed');
         }
      } catch (error) {
          setLoginError('Server connection error');
      }
  };

  const handleLogout = () => {
      setToken(null);
      setUserRole(null);
      setUsername(null);
      localStorage.removeItem('altLeaves_token');
      localStorage.removeItem('altLeaves_role');
      localStorage.removeItem('altLeaves_username');
      setShowAdminPanel(false);
  };

  const handleCreateUser = async (e) => {
      e.preventDefault();
      setAdminMessage('');
      try {
         const res = await fetch(`${API_URL}/users`, {
             method: 'POST',
             headers: { 
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
             },
             body: JSON.stringify(newUserForm)
         });
         const data = await res.json();
         if (res.ok) {
             setAdminMessage('User created successfully!');
             setNewUserForm({username: '', password: ''});
             setTimeout(() => setAdminMessage(''), 3000);
         } else {
             setAdminMessage('Error: ' + (data.error || 'Failed'));
         }
      } catch (error) {
          setAdminMessage('Server connection error');
      }
  };

  // --- Handlers ---
  const handleCreateEmployee = (e) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const newEmp = { 
        id: crypto.randomUUID(), 
        customId: newEmpCustomId.trim(),
        name: newEmpName.trim(),
        designation: newEmpDesignation.trim(),
        team: newEmpTeam.trim()
    };
    const newEmpList = [...employees, newEmp];
    setEmployees(newEmpList);
    setNewEmpName('');
    setNewEmpCustomId('');
    setNewEmpDesignation('');
    setNewEmpTeam('');
    if (!selectedEmpId) setSelectedEmpId(newEmp.id);
    syncToBackend(newEmpList, null, null);
  };

  const handleDeleteEmployee = (emp) => {
    setEmployeeToDelete(emp);
  };

  const confirmDeleteEmployee = () => {
    if (!employeeToDelete) return;
    const id = employeeToDelete.id;
    const newEmpList = employees.filter(emp => emp.id !== id);
    const newEarned = earnedLeaves.filter(leave => leave.empId !== id);
    const newTaken = takenLeaves.filter(leave => leave.empId !== id);
    
    setEmployees(newEmpList);
    setEarnedLeaves(newEarned);
    setTakenLeaves(newTaken);
    if (selectedEmpId === id) setSelectedEmpId(null);
    setEmployeeToDelete(null);
    syncToBackend(newEmpList, newEarned, newTaken);
  };

  const handleAddEarnedLeave = (e) => {
    e.preventDefault();
    if (!selectedEmpId || !earnedDate || !earnedReason) return;
    
    // Ensure the date falls in the selected month
    if (!earnedDate.startsWith(selectedMonth)) {
        alert("Please select a date within the chosen month.");
        return;
    }

    const newLeave = {
      id: crypto.randomUUID(),
      empId: selectedEmpId,
      month: selectedMonth,
      date: earnedDate,
      reason: earnedReason
    };
    const newEarnedLeaves = [...earnedLeaves, newLeave];
    setEarnedLeaves(newEarnedLeaves);
    setEarnedDate('');
    setEarnedReason('');
    syncToBackend(null, newEarnedLeaves, null);
  };

  const handleAddTakenLeave = (e) => {
    e.preventDefault();
    if (!selectedEmpId || !takenDate || !takenRefId) return;

     // Ensure the date falls in the selected month
     if (!takenDate.startsWith(selectedMonth)) {
        alert("Please select a date within the chosen month.");
        return;
    }

    const newTaken = {
      id: crypto.randomUUID(),
      empId: selectedEmpId,
      month: selectedMonth,
      date: takenDate,
      earnedLeaveId: takenRefId
    };
    const newTakenLeaves = [...takenLeaves, newTaken];
    setTakenLeaves(newTakenLeaves);
    setTakenDate('');
    setTakenRefId('');
    syncToBackend(null, null, newTakenLeaves);
  };

  const deleteEarnedLeave = (id) => {
    // Also remove any taken leave associated with it
    const newTaken = takenLeaves.filter(t => t.earnedLeaveId !== id);
    const newEarned = earnedLeaves.filter(e => e.id !== id);
    setTakenLeaves(newTaken);
    setEarnedLeaves(newEarned);
    syncToBackend(null, newEarned, newTaken);
  };

  const deleteTakenLeave = (id) => {
      const newTaken = takenLeaves.filter(t => t.id !== id);
      setTakenLeaves(newTaken);
      syncToBackend(null, null, newTaken);
  };

  // --- Derived Data for Selected Context ---
  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name.toLowerCase().includes(term) || 
      (emp.customId && emp.customId.toLowerCase().includes(term))
    );
  }, [employees, searchTerm]);

  const currentEarnedLeaves = useMemo(() => {
    return earnedLeaves.filter(l => l.empId === selectedEmpId && l.month === selectedMonth)
                       .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [earnedLeaves, selectedEmpId, selectedMonth]);

  const currentTakenLeaves = useMemo(() => {
    return takenLeaves.filter(l => l.empId === selectedEmpId && l.month === selectedMonth)
                      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [takenLeaves, selectedEmpId, selectedMonth]);

  const availableEarnedLeaves = useMemo(() => {
    const takenIds = currentTakenLeaves.map(t => t.earnedLeaveId);
    return currentEarnedLeaves.filter(e => !takenIds.includes(e.id));
  }, [currentEarnedLeaves, currentTakenLeaves]);

  const stats = useMemo(() => {
    const earned = currentEarnedLeaves.length;
    const taken = currentTakenLeaves.length;
    return { earned, taken, remaining: earned - taken };
  }, [currentEarnedLeaves, currentTakenLeaves]);

  // Month bounds for date pickers
  const monthStart = `${selectedMonth}-01`;
  const monthEnd = `${selectedMonth}-${new Date(selectedMonth.split('-')[0], selectedMonth.split('-')[1], 0).getDate()}`;

  // --- Helper to format date ---
  const formatDate = (dateString) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // --- View Only Status ---
  const isViewerRole = !token;

  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading data...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      
      {/* Top Auth Bar */}
      <div className="bg-slate-900 border-b border-white/10 text-slate-300 py-2 px-6 flex justify-between items-center text-xs w-full z-50">
         <div>
            {isViewerRole ? (
              <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5"/> Viewing as Guest - Read Only</span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                 <CheckCircle2 className="w-3.5 h-3.5"/> Logged in as: {username} ({userRole})
              </span>
            )}
         </div>
         
         <div className="flex items-center gap-4">
           {!token ? (
              <button onClick={() => setShowLogin(true)} className="hover:text-white transition-colors">Admin/User Login</button>
           ) : (
             <>
               {userRole === 'admin' && (
                 <button onClick={() => setShowAdminPanel(true)} className="hover:text-blue-400 transition-colors font-medium">Create User</button>
               )}
               <button onClick={handleLogout} className="hover:text-red-400 transition-colors">Logout</button>
             </>
           )}
         </div>
      </div>

      {/* HERO SECTION */}
      <header className="bg-gradient-to-br from-indigo-900 via-blue-800 to-blue-600 text-white pb-12 pt-10 px-6 sm:px-12 shadow-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-300" />
                Alternative Leave Tracker
              </h1>
              <p className="text-blue-200 text-lg max-w-xl">
                Manage off-day work and corresponding leaves. Earned leaves must be used within the same calendar month.
              </p>
            </div>
            
            {/* Create Employee Box */}
            {!isViewerRole && (
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-lg w-full md:w-[380px]">
                  <h3 className="text-sm font-semibold text-blue-100 uppercase tracking-wider mb-3">Create Employee</h3>
                  <form onSubmit={handleCreateEmployee} className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Employee Name *"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="ID (Optional)"
                        value={newEmpCustomId}
                        onChange={(e) => setNewEmpCustomId(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Team"
                        value={newEmpTeam}
                        onChange={(e) => setNewEmpTeam(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Designation"
                      value={newEmpDesignation}
                      onChange={(e) => setNewEmpDesignation(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-white/90 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full text-sm"
                    />
                    <button 
                      type="submit"
                      disabled={!newEmpName.trim()}
                      className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 mt-1 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                    >
                      <UserPlus className="w-4 h-4" />
                      Add Employee
                    </button>
                  </form>
                </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN SECTION */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-8 -mt-8 relative z-20">
        
        {/* Month Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Month</h2>
              <p className="text-slate-800 font-medium">Tracking leaves bounding period</p>
            </div>
          </div>
          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          />
        </div>

        {/* 5 COLUMN DASHBOARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 items-start">
          
          {/* Column 1: Select Employee */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-500" />
                <h2 className="font-semibold text-slate-800">1. Select Employee</h2>
              </div>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input 
                  type="text" 
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 pl-9 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {employees.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No employees found.<br/>Add one above.</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No results found.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredEmployees.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => setSelectedEmpId(emp.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition-all duration-200 flex items-center justify-between cursor-pointer ${
                        selectedEmpId === emp.id 
                          ? 'border-indigo-500 bg-indigo-50 shadow-sm' 
                          : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col overflow-hidden mr-2">
                        <span className={`font-medium truncate ${selectedEmpId === emp.id ? 'text-indigo-900' : 'text-slate-700'}`}>{emp.name}</span>
                        {(emp.customId || emp.designation || emp.team) && (
                          <span className={`text-[10px] truncate ${selectedEmpId === emp.id ? 'text-indigo-700' : 'text-slate-500'}`}>
                            {[emp.customId, emp.designation, emp.team].filter(Boolean).join(' • ')}
                          </span>
                        )}
                      </div>
                      
                      {!isViewerRole && (
                          <div className="flex items-center gap-1 shrink-0">
                            {selectedEmpId === emp.id && <CheckCircle2 className="w-4 h-4 text-indigo-500 mr-1" />}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEmployee(emp);
                                }}
                                className={`transition-colors p-1.5 rounded-md ${selectedEmpId === emp.id ? 'text-indigo-400 hover:text-red-500 hover:bg-red-50' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                                title="Delete Employee"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Wrapper for Cols 2-5 requiring selected employee */}
          {selectedEmpId ? (
            <>
              {/* Column 2: Add Earned Leave */}
              {!isViewerRole && (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center gap-2 text-emerald-800">
                      <CalendarPlus className="w-5 h-5" />
                      <h2 className="font-semibold">2. Log Off-Day Work</h2>
                    </div>
                    <div className="p-5 flex-1">
                      <form onSubmit={handleAddEarnedLeave} className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Date Worked (Off-day)</label>
                          <input 
                            type="date"
                            required
                            min={monthStart}
                            max={monthEnd}
                            value={earnedDate}
                            onChange={(e) => setEarnedDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          />
                          <p className="text-xs text-slate-500 mt-1">Must be within {selectedMonth}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Reason / Task</label>
                          <textarea 
                            required
                            rows="3"
                            placeholder="e.g. Server maintenance"
                            value={earnedReason}
                            onChange={(e) => setEarnedReason(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                          />
                        </div>
                        <button 
                          type="submit"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Earned Leave
                        </button>
                      </form>
                    </div>
                  </div>
              )}

              {/* Column 3: Total Earned Leaves */}
              <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] ${isViewerRole ? 'md:col-span-2' : ''}`}>
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List className="w-5 h-5 text-slate-500" />
                    <h2 className="font-semibold text-slate-800">3. Earned List</h2>
                  </div>
                  <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                    {stats.earned}
                  </span>
                </div>
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
                  {currentEarnedLeaves.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                      <Info className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No leaves earned<br/>this month.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentEarnedLeaves.map(leave => {
                        const isTaken = currentTakenLeaves.some(t => t.earnedLeaveId === leave.id);
                        return (
                          <div key={leave.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                            {!isViewerRole && (
                                <button 
                                  onClick={() => deleteEarnedLeave(leave.id)}
                                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Delete Earned Leave"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                            )}
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-700">{formatDate(leave.date)}</span>
                              {isTaken ? (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Used</span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Available</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 line-clamp-2">{leave.reason}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: Taken Leaves */}
              <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px] ${isViewerRole ? 'md:col-span-2' : ''}`}>
                <div className="bg-amber-50 border-b border-amber-100 p-4 flex items-center gap-2 text-amber-800">
                  <CalendarMinus className="w-5 h-5" />
                  <h2 className="font-semibold">4. Log Taken Leave</h2>
                </div>
                <div className="p-4 flex flex-col h-full overflow-hidden">
                  
                  {/* Take Leave Form */}
                  {!isViewerRole && (
                      <form onSubmit={handleAddTakenLeave} className="space-y-4 mb-6 shrink-0">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Date Taken</label>
                          <input 
                            type="date"
                            required
                            min={monthStart}
                            max={monthEnd}
                            value={takenDate}
                            onChange={(e) => setTakenDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Against Earned Date</label>
                          <select 
                            required
                            value={takenRefId}
                            onChange={(e) => setTakenRefId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                          >
                            <option value="">Select available leave...</option>
                            {availableEarnedLeaves.map(leave => (
                              <option key={leave.id} value={leave.id}>
                                {formatDate(leave.date)} - {leave.reason.substring(0, 20)}...
                              </option>
                            ))}
                          </select>
                        </div>
                        <button 
                          type="submit"
                          disabled={availableEarnedLeaves.length === 0}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Record Taken Leave
                        </button>
                      </form>
                  )}

                  {/* Taken Leaves List */}
                  <div className={`flex-1 overflow-y-auto ${!isViewerRole ? 'border-t border-slate-100 pt-4' : ''}`}>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Taken This Month</h3>
                    {currentTakenLeaves.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-4">No leaves taken yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {currentTakenLeaves.map(taken => {
                          const refLeave = earnedLeaves.find(e => e.id === taken.earnedLeaveId);
                          return (
                            <div key={taken.id} className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 relative group">
                              {!isViewerRole && (
                                  <button 
                                    onClick={() => deleteTakenLeave(taken.id)}
                                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete Taken Leave"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                              )}
                              <div className="text-sm font-semibold text-slate-800">{formatDate(taken.date)}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                Used: <span className="font-medium">{refLeave ? formatDate(refLeave.date) : 'Unknown'}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 5: Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center gap-2 text-blue-800">
                  <PieChart className="w-5 h-5" />
                  <h2 className="font-semibold">5. Monthly Summary</h2>
                </div>
                <div className="p-6 flex-1 flex flex-col justify-center space-y-6">
                  
                  {/* Earned Metric */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Earned</p>
                      <p className="text-xs text-slate-400 mt-1">Days worked off</p>
                    </div>
                    <span className="text-3xl font-bold text-emerald-600">{stats.earned}</span>
                  </div>

                  {/* Taken Metric */}
                  <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Taken</p>
                      <p className="text-xs text-slate-400 mt-1">Leaves consumed</p>
                    </div>
                    <span className="text-3xl font-bold text-amber-500">{stats.taken}</span>
                  </div>

                  <div className="my-2 border-t border-slate-200 border-dashed"></div>

                  {/* Remaining Metric */}
                  <div className={`rounded-xl p-6 border flex items-center justify-between transition-colors ${
                    stats.remaining > 0 
                      ? 'bg-blue-600 border-blue-700 text-white shadow-md' 
                      : 'bg-slate-100 border-slate-300 text-slate-400'
                  }`}>
                    <div>
                      <p className="text-sm font-medium uppercase tracking-wider opacity-90">Remaining</p>
                      <p className="text-xs mt-1 opacity-75">Must use this month</p>
                    </div>
                    <span className="text-4xl font-black">{stats.remaining}</span>
                  </div>

                  {stats.remaining > 0 && (
                     <div className="text-center mt-auto pt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full">
                           <AlertCircle className="w-3.5 h-3.5" />
                           {stats.remaining} day(s) expire end of {new Date(selectedMonth).toLocaleString('default', { month: 'long' })}
                        </span>
                     </div>
                  )}

                </div>
              </div>
            </>
          ) : (
            /* Placeholder state when no employee is selected (spans the remaining 4 columns) */
            <div className="md:col-span-1 xl:col-span-4 bg-slate-100/50 rounded-2xl border border-slate-200 border-dashed flex flex-col items-center justify-center h-[600px] text-slate-400">
               <Users className="w-16 h-16 mb-4 opacity-20" />
               <h3 className="text-xl font-medium text-slate-500">No Employee Selected</h3>
               <p className="mt-2 text-sm max-w-sm text-center">Please select an employee from the first column to view and manage their compensatory leaves for {selectedMonth}.</p>
            </div>
          )}

        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {employeeToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4 mx-auto">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-center text-slate-900 mb-2">Delete Employee?</h3>
            <p className="text-slate-500 text-center text-sm mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-800">{employeeToDelete.name}</span>? All their associated leave data will also be permanently removed.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setEmployeeToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteEmployee}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-sm shadow-red-200"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Login</h2>
            {loginError && <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 p-2 rounded">{loginError}</div>}
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input 
                 type="text" required placeholder="User ID" 
                 value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                 className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
              <input 
                 type="password" required placeholder="Password" 
                 value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                 className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              />
              <div className="flex gap-2">
                 <button type="button" onClick={() => setShowLogin(false)} className="flex-1 py-2 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
                 <button type="submit" className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Login</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Admin panel</h2>
            <p className="text-sm text-slate-500 mb-4 pb-4 border-b">Create new users who can edit the employee entries.</p>
            
            {adminMessage && <div className={`mb-4 text-xs font-semibold p-2 rounded ${adminMessage.includes('Error') ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}>{adminMessage}</div>}
            
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <input 
                 type="text" required placeholder="New User ID" 
                 value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})}
                 className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
              />
              <input 
                 type="password" required placeholder="Secret Password" 
                 value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})}
                 className="px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
              />
              <div className="flex gap-2 mt-2">
                 <button type="button" onClick={() => setShowAdminPanel(false)} className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-50 font-medium">Close</button>
                 <button type="submit" className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
