console.log("🔥 USING SERVER FILE:", __filename);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
console.log("MongoDB URI:", process.env.MONGODB_URI ? "Loaded ✅" : "Missing ❌");

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 15000,
})
.then(() => console.log('✅ MongoDB Connected Successfully'))
.catch(err => console.error('❌ MongoDB Connection Error:', err.message));


// ================= USER SCHEMA =================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' }
});

const User = mongoose.model('User', userSchema);


// ================= TASK SCHEMA =================
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Correct Task History Format
  history: [
    {
      message: String,
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

const Task = mongoose.model("Task", taskSchema);


// ================= EMAIL SETUP =================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendTaskEmail(userEmail, userName, taskTitle, taskDescription) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: `New Task Assigned: ${taskTitle}`,
    html: `
      <h2>Hello ${userName},</h2>
      <p>You have been assigned a new task:</p>
      <h3>${taskTitle}</h3>
      <p>${taskDescription}</p>
      <p>Please log in to TaskSync to view more details.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Email Sending Error:', error);
  }
}


// ================= ROUTES =================

// Login Route
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Create Test Admin User (run once)
app.post('/api/create-test-user', async (req, res) => {
  try {
    const testUser = new User({
      name: 'Admin User',
      email: 'admin@tasksync.com',
      password: 'admin123',
      role: 'admin'
    });

    await testUser.save();
    res.json({ message: '✅ Test admin created successfully' });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Create User
app.post('/api/users', async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();

    res.status(201).json(user);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// Get All Users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Update User (role update)
app.put('/api/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json(updatedUser);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ================= CREATE TASK (FIXED COMPLETELY) =================
// Create Task
// Create Task
app.post("/api/tasks", async (req, res) => {
  try {
    const { title, description, assignedTo, status } = req.body;

    if (!title || !description || !assignedTo) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Validate assigned user
    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(400).json({ error: "Assigned user does not exist" });
    }

    const validStatuses = ["pending", "in-progress", "completed"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid task status" });
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      status: status || "pending",
      history: [
        {
          message: `Task created and assigned to ${user.name}`,
          timestamp: new Date(),
        },
      ],
    });

    const saved = await task.save();

    // Populate so frontend gets full user object
    const populatedTask = await Task.findById(saved._id).populate("assignedTo");

    // Send email
    await sendTaskEmail(user.email, user.name, title, description);

    res.status(201).json(populatedTask);
  } catch (error) {
    console.error("❌ Task creation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ================= GET ALL TASKS =================
app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await Task.find().populate("assignedTo").sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error("❌ Error fetching tasks:", error);
    res.status(500).json({ error: error.message });
  }
});


// ================= UPDATE TASK (SECURE + HISTORY) =================
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ error: "Task not found" });

    let historyMessage = null;

    if (req.body.status && req.body.status !== task.status) {
      historyMessage = `Status changed: ${task.status} → ${req.body.status}`;
    } else if (
      req.body.title !== task.title ||
      req.body.description !== task.description ||
      String(req.body.assignedTo) !== String(task.assignedTo)
    ) {
      historyMessage = `Task updated by admin`;
    }

    Object.assign(task, req.body);
    task.updatedAt = new Date();

    if (historyMessage) {
      task.history.push({
        message: historyMessage,
        timestamp: new Date()
      });
    }

    await task.save();
    const updatedTask = await Task.findById(task._id).populate("assignedTo");

    res.json(updatedTask);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ================= DELETE TASK (ADMIN ONLY) =================
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    const user = await User.findById(userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can delete tasks' });
    }

    const deleted = await Task.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ error: 'Task not found' });

    res.json({ message: 'Task deleted successfully' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Health Check
app.get('/', (req, res) => {
  res.json({ message: '✅ TaskSync API is running successfully!' });
});


// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


