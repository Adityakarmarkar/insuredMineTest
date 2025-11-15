require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const uploadRoutes = require('./routes');
const cpuMonitorRoutes = require('./routes/cpuMonitor');
const app = express();
const PORT = process.env.PORT || 3000;
const CPUMonitor = require('./utils/cpuMonitor');


// Initialize CPU Monitor
const cpuMonitor = new CPUMonitor(
  parseFloat(process.env.CPU_THRESHOLD) || 0.1, // 10% default
  parseInt(process.env.CPU_CHECK_INTERVAL) || 5000 // 5 seconds default
);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB connected successfully');
})
.catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
});

// MongoDB connection events
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
    console.error('MongoDB error:', error);
});


// Middleware
app.use(cors('*'));
app.use(bodyParser.json());
app.set('cpuMonitor', cpuMonitor);



// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});


// Routes
app.use('/taskone', uploadRoutes);
app.use('/tasktwo', cpuMonitorRoutes);


const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Start CPU monitoring
    cpuMonitor.start();
});

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    cpuMonitor.stop();
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    cpuMonitor.stop();
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close();
    });
});