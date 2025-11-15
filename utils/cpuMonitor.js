const os = require('os-utils');
const { exec } = require('child_process');

class CPUMonitor {
  constructor(threshold = 0.7, checkInterval = 5000) {
    this.threshold = threshold; // 70% = 0.7
    this.checkInterval = checkInterval; // Check every 5 seconds
    this.isMonitoring = false;
    this.consecutiveHighUsage = 0;
    this.requiredConsecutiveChecks = 3; // Restart after 3 consecutive high readings
  }

  start() {
    if (this.isMonitoring) {
      console.log('CPU monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log(`CPU monitoring started. Threshold: ${this.threshold * 100}%`);

    this.monitorInterval = setInterval(() => {
      os.cpuUsage((usage) => {
        const cpuPercent = (usage * 100).toFixed(2);
        console.log(`CPU Usage: ${cpuPercent}%`);

        if (usage >= this.threshold) {
          this.consecutiveHighUsage++;
          console.warn(`⚠️  High CPU usage detected: ${cpuPercent}% (Count: ${this.consecutiveHighUsage}/${this.requiredConsecutiveChecks})`);

          if (this.consecutiveHighUsage >= this.requiredConsecutiveChecks) {
            console.error(`🔴 CPU usage exceeded ${this.threshold * 100}% for ${this.requiredConsecutiveChecks} consecutive checks. Restarting server...`);
            this.restartServer();
          }
        } else {
          // Reset counter if CPU usage drops below threshold
          if (this.consecutiveHighUsage > 0) {
            console.log(`✅ CPU usage normalized: ${cpuPercent}%`);
          }
          this.consecutiveHighUsage = 0;
        }
      });
    }, this.checkInterval);
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.isMonitoring = false;
      console.log('CPU monitoring stopped');
    }
  }

  restartServer() {
    this.stop();

    // Log restart event
    console.log('============================================');
    console.log('SERVER RESTART INITIATED');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Reason: CPU usage exceeded ${this.threshold * 100}%`);
    console.log('============================================');

    // Using PM2 (recommended for production)
    if (process.env.PM2_HOME) {
      console.log('Restarting via PM2...');
      exec('pm2 restart insuredMineTest', (error, stdout, stderr) => {
        if (error) {
          console.error(`PM2 restart error: ${error}`);
          this.fallbackRestart();
        } else {
          console.log('PM2 restart initiated successfully');
        }
      });
    } else {
      // Fallback: exit process (works with nodemon or process managers)
      this.fallbackRestart();
    }
  }

  fallbackRestart() {
    console.log('Performing graceful shutdown...');
    
    // Give time for cleanup
    setTimeout(() => {
      process.exit(1); // Exit with error code to trigger restart
    }, 1000);
  }

  getCPUInfo() {
    return {
      cpuCount: os.cpuCount(),
      freeMem: os.freemem(),
      totalMem: os.totalmem(),
      freeMemPercentage: os.freememPercentage(),
      platform: os.platform(),
      loadAvg: os.loadavg()
    };
  }
}

module.exports = CPUMonitor;