var express = require('express');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
var router = express.Router();
const { Message } = require('../schemas');


router.get('/cpu-stats', async (req, res) => {
  try {
    const cpuInfo = req.app.get('cpuMonitor').getCPUInfo();
    res.json({
        success: true,
        monitoring: cpuInfo.monitoring,
        threshold: `${cpuInfo.threshold * 100}%`,
        ...cpuInfo
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


/* Stress test CPU */
router.post('/stress-cpu', (req, res) => {
  const { duration = 10000 } = req.body; // Default 10 seconds
  
  res.json({ 
    message: 'CPU stress test started',
    duration: `${duration}ms`
  });

  const startTime = Date.now();
  const endTime = startTime + duration;

  const stressLoop = () => {
    if (Date.now() < endTime) {
      let result = 0;
      for (let i = 0; i < 10000000; i++) {
        result += Math.sqrt(i) * Math.random();
      }
      setImmediate(stressLoop);
    } else {
      console.log('CPU stress test completed');
    }
  };

  stressLoop();
});


router.post('/schedule-message', async (req, res) => {
  try {
    const { message, day, time } = req.body;

    // Validation
    if (!message || !day || !time) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['message', 'day', 'time']
      });
    }

    // Expected format: day: "2024-11-15", time: "14:30:00" or "14:30"
    const scheduledDate = new Date(`${day}T${time}`);

    // Validate date
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date or time format',
        expectedFormat: {
          day: 'YYYY-MM-DD (e.g., 2024-11-15)',
          time: 'HH:MM:SS or HH:MM (e.g., 14:30:00 or 14:30)'
        }
      });
    }
    console.log('Scheduled Date:', scheduledDate, new Date());
    // Check if date is in the future
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ 
        error: 'Scheduled time must be in the future',
        providedTime: scheduledDate.toISOString(),
        currentTime: new Date().toISOString()
      });
    }

    const newMessage = new Message({ 
      content: message, 
      scheduledFor: scheduledDate,
      status: 'pending'
    });

    await newMessage.save();

    // Schedule the task
    const job = schedule.scheduleJob(scheduledDate, async () => {
      try {
        await Message.findByIdAndUpdate(newMessage._id, {
          insertedAt: new Date(),
          status: 'inserted'
        });
        
        console.log('✅ Scheduled message inserted:', {
          id: newMessage._id,
          content: message,
          scheduledFor: scheduledDate,
          insertedAt: new Date()
        });
      } catch (error) {
        console.error('❌ Error inserting scheduled message:', error);
        
        await Message.findByIdAndUpdate(newMessage._id, {
          status: 'failed',
          error: error.message
        });
      }
    });

    return res.status(201).json({ 
      success: true,
      message: 'Message scheduled successfully',
      data: {
        id: newMessage._id,
        content: message,
        scheduledFor: scheduledDate.toISOString(),
        status: 'pending',
        jobName: job.name
      }
    });

  } catch (error) {
    console.error('Schedule message error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
});


module.exports = router;