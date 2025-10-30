const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user
    const newUser = await User.create({
      username,
      password
    });

    // Generate JWT token
    const token = signToken(newUser._id);

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: {
          id: newUser._id,
          username: newUser.username,
          firstLogin: newUser.firstLogin
        }
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ username });
    if (!user || !(await user.correctPassword(password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = signToken(user._id);

    res.json({
      status: 'success',
      token,
      data: {
        user: {
          id: user._id,
          username: user.username,
          whatsappReady: user.whatsappReady,
          firstLogin: user.firstLogin
        }
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
