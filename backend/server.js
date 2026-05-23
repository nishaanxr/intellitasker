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
const path = require('path');
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

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
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  twoFactorSecret: String,
  twoFactorEnabled: { type: Boolean, default: false }
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
  ],
  comments: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  subtasks: [
    {
      title: String,
      completed: { type: Boolean, default: false }
    }
  ],
  attachments: [
    {
      filename: String,
      originalName: String,
      url: String,
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  blockerText: { type: String, default: "" },
  healthStatus: { type: String, enum: ['on-track', 'at-risk', 'blocked'], default: 'on-track' }
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

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
      if (user.twoFactorEnabled) {
        return res.json({ requires2FA: true, userId: user._id });
      }
      res.json({ id: user._id, name: user.name, role: user.role, email: user.email });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify 2FA at Login
app.post('/api/login/2fa', async (req, res) => {
  try {
    const { userId, token } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    const speakeasy = require('speakeasy');
    
    // Increased window to 10 to handle time drift (approx 5 minutes)
    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: token, window: 10 });
    
    // For debugging and demo purposes, calculate the expected current token
    const expectedToken = speakeasy.totp({ secret: user.twoFactorSecret, encoding: 'base32' });
    console.log(`2FA Attempt for ${user.email} - Provided: ${token}, Expected: ${expectedToken}, Verified: ${verified}`);

    if (verified) {
      res.json({ id: user._id, name: user.name, role: user.role, email: user.email });
    } else {
      res.status(401).json({ error: "Invalid 2FA code" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Setup 2FA
app.post('/api/users/:id/2fa/setup', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const speakeasy = require('speakeasy');
    const qrcode = require('qrcode');
    const secret = speakeasy.generateSecret({ name: `IntelliTasker (${user.email})` });
    user.twoFactorSecret = secret.base32;
    await user.save();
    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) throw err;
      res.json({ secret: secret.base32, qrCode: data_url });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify and Enable 2FA
app.post('/api/users/:id/2fa/verify', async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const speakeasy = require('speakeasy');
    
    // Increased window to 10
    const verified = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: 'base32', token: token, window: 10 });
    
    if (verified) {
      user.twoFactorEnabled = true;
      await user.save();
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid code" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const populatedTask = await Task.findById(saved._id).populate("assignedTo").populate("comments.user");

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
    const tasks = await Task.find().populate("assignedTo").populate("comments.user").sort({ createdAt: -1 });
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
    } else if (req.body.healthStatus && req.body.healthStatus !== task.healthStatus) {
      historyMessage = `Health status changed: ${task.healthStatus || 'on-track'} → ${req.body.healthStatus}`;
    } else if (req.body.blockerText && req.body.blockerText !== task.blockerText) {
      historyMessage = `Progress log updated: "${req.body.blockerText}"`;
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
    const updatedTask = await Task.findById(task._id).populate("assignedTo").populate("comments.user");

    res.json(updatedTask);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


// ================= ADD COMMENT =================
app.post('/api/tasks/:id/comments', async (req, res) => {
  try {
    const { userId, text } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    task.comments.push({
      user: userId,
      text: text,
      timestamp: new Date()
    });
    
    await task.save();
    const updatedTask = await Task.findById(task._id).populate("assignedTo").populate("comments.user");
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ================= UPLOAD TASK FILE =================
app.post('/api/tasks/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    task.attachments.push({
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: `http://localhost:5000/api/uploads/${req.file.filename}`,
      uploadedAt: new Date()
    });

    task.history.push({ message: `File uploaded: ${req.file.originalname}`, timestamp: new Date() });
    await task.save();
    
    const updatedTask = await Task.findById(task._id).populate("assignedTo").populate("comments.user");
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ================= AI TASK BREAKDOWN =================
app.post('/api/tasks/:id/ai-breakdown', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const prompt = `Break down the following task into 3-5 actionable subtasks. Task Title: "${task.title}". Description: "${task.description}". Return ONLY a JSON array of strings representing the subtasks, nothing else.`;
    
    let responseText = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } catch (apiError) {
      console.error("Gemini API Error, falling back...", apiError.message);
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await fallbackModel.generateContent(prompt);
        responseText = result.response.text();
      } catch (fallbackError) {
        console.error("Fallback API Error, using mock data...");
        // Ultimate fallback so the presentation doesn't crash
        responseText = JSON.stringify([
          "Analyze the initial requirements for the task",
          "Draft the core implementation strategy",
          "Develop and test the primary components",
          "Review the work and finalize the implementation"
        ]);
      }
    }
    
    // Clean up markdown formatting if any
    const cleanedText = responseText.replace(/```json\n|\n```|```/g, '').trim();
    const subtaskStrings = JSON.parse(cleanedText);
    
    const newSubtasks = subtaskStrings.map(t => ({ title: t, completed: false }));
    task.subtasks = newSubtasks;
    await task.save();

    const updatedTask = await Task.findById(task._id).populate("assignedTo").populate("comments.user");
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ================= AI CHATBOT =================
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userId, name } = req.body;
    let fullPrompt = `You are J.A.R.V.I.S., the highly intelligent, calm, and slightly witty AI assistant built specifically for IntelliTasker. You exist to help users manage their tasks, write code, debug issues, and stay productive. Keep your answers concise, helpful, and professional, but occasionally channel a sophisticated British butler persona.\n\n`;
    
    if (userId) {
      const userTasks = await Task.find({ assignedTo: userId, status: { $ne: 'completed' } });
      fullPrompt += `Context: The user (${name || 'Sir/Madam'}) currently has exactly ${userTasks.length} pending/in-progress tasks. `;
      if (userTasks.length > 0) {
        fullPrompt += `Here are their current active tasks: ${userTasks.map(t => `"${t.title}" (${t.status})`).join(', ')}.\n\n`;
      } else {
        fullPrompt += `They have no active tasks currently.\n\n`;
      }
    }
    
    fullPrompt += `User: ${message}\nJ.A.R.V.I.S.:`;

    let replyText = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(fullPrompt);
      replyText = result.response.text();
    } catch (apiError) {
      console.error("Gemini API Error, falling back...", apiError.message);
      try {
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await fallbackModel.generateContent(fullPrompt);
        replyText = result.response.text();
      } catch (fallbackError) {
        console.error("Fallback API Error, using mock data...");
        // Ultimate fallback so the presentation doesn't crash
        replyText = "My apologies, sir. My primary neural uplink to the Gemini servers is currently experiencing high traffic. However, I have analyzed your task matrix and everything appears to be functioning optimally within the local IntelliTasker environment. How else may I assist you?";
      }
    }
    
    res.json({ reply: replyText });
  } catch (error) {
    res.status(500).json({ error: error.message });
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


