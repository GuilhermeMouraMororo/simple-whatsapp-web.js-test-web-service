require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

// Route imports
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// JWT middleware
const jwt = require('jsonwebtoken');
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// MongoDB connection - ONLY ONE CONNECTION
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection FAIL:', error);
    process.exit(1);
  }
};

// Start server only after MongoDB connection
const startServer = async () => {
  await connectDB();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
