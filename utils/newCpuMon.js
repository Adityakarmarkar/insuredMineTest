const os = require('os-utils');
const { exec } = require('child_process');

const CPU_THRESHOLD = 70; // CPU usage threshold in percentage
const CHECK_INTERVAL = 5000; // Check every 5 seconds

let appProcess = exec('node server.js'); // Replace with your server entry file (e.g., 'app.js')

console.log(`Server started with PID: ${appProcess.pid}`);

function monitorCpu() {
  os.cpuUsage((usage) => {
    const cpuPercent = usage * 100;
    console.log(`Current CPU Usage: ${cpuPercent.toFixed(2)}%`);

    if (cpuPercent > CPU_THRESHOLD) {
      console.warn(`CPU usage exceeded ${CPU_THRESHOLD}%. Restarting server...`);

      // Kill the server process
      appProcess.kill();

      // Restart the server after a delay
      setTimeout(() => {
        appProcess = exec('node server.js');
        console.log(`Server restarted with new PID: ${appProcess.pid}`);
      }, 2000);
    }
  });
}

// Start monitoring loop
setInterval(monitorCpu, CHECK_INTERVAL);
