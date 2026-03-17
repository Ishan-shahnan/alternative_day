const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'your-very-secret-key'; // Change in production

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (Frontend)
const path = require('path');
app.use(express.static(path.join(__dirname, '/')));

// Initialize SQLite database
const dbPath = process.env.DATABASE_PATH || './data.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database.');
    
    // Create tables
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )`, (err) => {
        if (!err) {
          // Check if admin exists
          db.get('SELECT * FROM users WHERE username = ?', ['Leave'], (err, row) => {
            if (!row) {
               // Create default admin user: Admin ID: Leave, Pass: iBOS#Hadi
               bcrypt.hash('iBOS#Hadi', 10, (err, hash) => {
                 db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['Leave', hash, 'admin']);
                 console.log('Default admin user created.');
               });
            }
          });

          // Check if superadmin exists
          db.get('SELECT * FROM users WHERE role = ?', ['superadmin'], (err, row) => {
            if (!row) {
               bcrypt.hash('superadmin123', 10, (err, hash) => {
                 db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['superadmin', hash, 'superadmin']);
                 console.log('Default superadmin user created.');
               });
            }
          });
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      customId TEXT,
      name TEXT,
      designation TEXT,
      team TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS earnedLeaves (
      id TEXT PRIMARY KEY,
      empId TEXT,
      month TEXT,
      date TEXT,
      reason TEXT,
      FOREIGN KEY(empId) REFERENCES employees(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS takenLeaves (
      id TEXT PRIMARY KEY,
      empId TEXT,
      month TEXT,
      date TEXT,
      earnedLeaveId TEXT,
      FOREIGN KEY(empId) REFERENCES employees(id),
      FOREIGN KEY(earnedLeaveId) REFERENCES earnedLeaves(id)
    )`);
  }
});

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireUserOrAdmin = (req, res, next) => {
     if (req.user.role !== 'admin' && req.user.role !== 'user' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

const requireSuperAdmin = (req, res, next) => {
    if (req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Superadmin access required' });
    }
    next();
};

// --- Routes ---

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, user.password, (err, result) => {
      if (result) {
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY);
        res.json({ token, role: user.role, username: user.username });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    });
  });
});

// Admin: Create User
app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    const { username, password } = req.body;
    
    bcrypt.hash(password, 10, (err, hash) => {
        if(err) return res.status(500).json({ error: err.message });
        
        db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, 'user'], function(err) {
             if (err) {
                 if(err.message.includes('UNIQUE constraint failed')){
                     return res.status(400).json({ error: 'Username already exists' });
                 }
                 return res.status(500).json({ error: err.message });
             }
             res.json({ id: this.lastID, username, role: 'user' });
        });
    });
});

// Superadmin: Get all users
app.get('/api/super/users', authenticateToken, requireSuperAdmin, (req, res) => {
    db.all('SELECT id, username, role FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(users);
    });
});

// Superadmin: Update user
app.put('/api/super/users/:id', authenticateToken, requireSuperAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (password) {
        bcrypt.hash(password, 10, (err, hash) => {
            db.run('UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?', [username, hash, role || 'user', req.params.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        });
    } else {
        db.run('UPDATE users SET username = ?, role = ? WHERE id = ?', [username, role || 'user', req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    }
});

// Superadmin: Delete user
app.delete('/api/super/users/:id', authenticateToken, requireSuperAdmin, (req, res) => {
    db.run('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// --- Data Routes (Protected for write, Open for read) ---

// Get all data (Public)
app.get('/api/data', (req, res) => {
    const data = { employees: [], earnedLeaves: [], takenLeaves: [] };
    
    db.all('SELECT * FROM employees', [], (err, employees) => {
        if (err) return res.status(500).json({ error: err.message });
        data.employees = employees;
        
        db.all('SELECT * FROM earnedLeaves', [], (err, earned) => {
            if (err) return res.status(500).json({ error: err.message });
            data.earnedLeaves = earned;
            
            db.all('SELECT * FROM takenLeaves', [], (err, taken) => {
                if (err) return res.status(500).json({ error: err.message });
                data.takenLeaves = taken;
                res.json(data);
            });
        });
    });
});

// Update entire state (Requires login)
app.post('/api/data', authenticateToken, requireUserOrAdmin, (req, res) => {
    const { employees, earnedLeaves, takenLeaves } = req.body;

    db.serialize(() => {
        // Simple syncing strategy: Clear and re-insert for small datasets
        db.run('BEGIN TRANSACTION');
        
        db.run('DELETE FROM employees');
        db.run('DELETE FROM earnedLeaves');
        db.run('DELETE FROM takenLeaves');

        const stmtEmp = db.prepare('INSERT INTO employees (id, customId, name, designation, team) VALUES (?, ?, ?, ?, ?)');
        employees.forEach(emp => stmtEmp.run(emp.id, emp.customId, emp.name, emp.designation, emp.team));
        stmtEmp.finalize();

        const stmtEarned = db.prepare('INSERT INTO earnedLeaves (id, empId, month, date, reason) VALUES (?, ?, ?, ?, ?)');
        earnedLeaves.forEach(leave => stmtEarned.run(leave.id, leave.empId, leave.month, leave.date, leave.reason));
        stmtEarned.finalize();
        
        const stmtTaken = db.prepare('INSERT INTO takenLeaves (id, empId, month, date, earnedLeaveId) VALUES (?, ?, ?, ?, ?)');
        takenLeaves.forEach(leave => stmtTaken.run(leave.id, leave.empId, leave.month, leave.date, leave.earnedLeaveId));
        stmtTaken.finalize();

        db.run('COMMIT', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });
});

// Serve the SuperAdmin page
app.get('/superadmin', (req, res) => {
    res.sendFile(path.join(__dirname, 'superadmin.html'));
});

// Fallback to index.html for any other routes (Frontend routing)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
