const express = require('express');
const os = require('os'); // Module to access system information
const app = express();
const PORT = 3000;

// --- New System Monitoring Logic ---
function monitorSystemLoad() {
    const load = os.loadavg(); // Gets system load averages (1, 5, and 15 minute averages)
    const timestamp = new Date().toISOString();
    const loadString = `System Load at ${timestamp}: 1-min Load=${load[0].toFixed(2)}, 5-min Load=${load[1].toFixed(2)}, 15-min Load=${load[2].toFixed(2)}`;
    
    // In a real application, this is where you would log to a database or send to an external reporting service.
    console.log(`[MONITOR] ${loadString}`);
    
    // Simulate sending the report to a background agent or reporting service
    // For this simulation, we will just log it, but in production, this would be an API call.
    sendSystemReport(loadString);
}

function sendSystemReport(report) {
    // Placeholder for calling a background reporting agent or external service
    console.log(`[REPORT AGENT]: Successfully reported load: ${report}`);
    // In a real setup, this might involve calling an external agent function or API endpoint.
}

// Setup the periodic monitoring task
// Schedule the monitoring function to run every 60,000 milliseconds (1 minute)
const intervalId = setInterval(monitorSystemLoad, 60000);
console.log("System load monitoring started. Checking every minute...");
// --- End of New Logic ---


// Basic Route for testing
app.get('/', (req, res) => {
    res.send('Personal Assistant Backend is running.');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Note: nodemon will watch this file and automatically restart the server on any save.
// The monitoring interval is now running in the background via setInterval.