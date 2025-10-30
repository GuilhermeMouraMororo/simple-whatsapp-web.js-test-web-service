const express = require('express');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');
const User = require('../models/User');
const QRCode = require('qrcode');
const router = express.Router();

// Store active clients
const activeClients = new Map();

// Initialize WhatsApp client for a user
const initializeWhatsAppClient = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // Generate unique clientId for this user
    const clientId = user.whatsappClientId || `user-${userId}-${Date.now()}`;
    
    // Update user with clientId if not set
    if (!user.whatsappClientId) {
      user.whatsappClientId = clientId;
      await user.save();
    }

    // Check if client already exists and is ready
    if (activeClients.has(clientId)) {
      const existingClient = activeClients.get(clientId);
      if (existingClient.status === 'ready') {
        return existingClient;
      }
    }

    const store = new MongoStore({ mongoose });
    const client = new Client({
      authStrategy: new RemoteAuth({
        store: store,
        backupSyncIntervalMs: 300000,
        clientId: clientId
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    const clientData = {
      client,
      qrCode: null,
      status: 'initializing',
      authenticated: false
    };

    activeClients.set(clientId, clientData);

    client.on('qr', async (qr) => {
      console.log(`QR received for user ${userId}`);
      clientData.qrCode = qr;
      clientData.status = 'qr_waiting';
    });

    client.on('ready', async () => {
      console.log(`WhatsApp client ready for user ${userId}`);
      clientData.status = 'ready';
      clientData.authenticated = true;
      
      // Update user status
      await User.findByIdAndUpdate(userId, {
        whatsappReady: true,
        firstLogin: false
      });
    });

    client.on('remote_session_saved', () => {
      console.log(`Session saved for user ${userId}`);
    });

    client.on('auth_failure', (msg) => {
      console.error(`Auth failure for user ${userId}:`, msg);
      clientData.status = 'auth_failure';
      activeClients.delete(clientId);
    });

    client.on('disconnected', async (reason) => {
      console.log(`Client disconnected for user ${userId}:`, reason);
      clientData.status = 'disconnected';
      await User.findByIdAndUpdate(userId, { whatsappReady: false });
      activeClients.delete(clientId);
    });

    await client.initialize();
    return clientData;

  } catch (error) {
    console.error('Error initializing WhatsApp client:', error);
    throw error;
  }
};

// Get QR code for authentication
router.get('/qr', async (req, res) => {
  try {
    const userId = req.user.id;
    const clientData = await initializeWhatsAppClient(userId);
    
    if (clientData.qrCode) {
      const qrImage = await QRCode.toDataURL(clientData.qrCode);
      res.json({ qrCode: qrImage, status: clientData.status });
    } else {
      res.json({ qrCode: null, status: clientData.status });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message endpoint
router.post('/send-message', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user.whatsappReady) {
      return res.status(400).json({ error: 'WhatsApp client not ready' });
    }

    const clientData = activeClients.get(user.whatsappClientId);
    if (!clientData || clientData.status !== 'ready') {
      return res.status(400).json({ error: 'WhatsApp client not authenticated or ready' });
    }

    const phoneNumber = '5585989764552'; // Your number without +
    const chatId = `${phoneNumber}@c.us`;
    
    await clientData.client.sendMessage(chatId, 'Hello World');
    res.json({ status: 'success', message: 'Message sent successfully' });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
});

// Check WhatsApp status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clientData = user.whatsappClientId ? activeClients.get(user.whatsappClientId) : null;
    
    res.json({
      whatsappReady: user.whatsappReady,
      status: clientData ? clientData.status : 'not_initialized',
      firstLogin: user.firstLogin
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
