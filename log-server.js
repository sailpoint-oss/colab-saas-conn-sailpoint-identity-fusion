#!/usr/bin/env node
const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 2389;
const LOG_FILE = process.env.LOG_FILE || 'logs/remote-logs.txt';

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    
    // Timestamp color
    cyan: '\x1b[36m',
    
    // Log level colors
    debug: '\x1b[35m',    // Magenta
    info: '\x1b[32m',     // Green
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m',    // Red
    
    // Default text
    white: '\x1b[37m'
};

// Colorize log messages
const colorizeLog = (message) => {
    // Match pattern: HH:MM:SS [LEVEL] origin: message
    // Supports both [ServiceName>methodName] and ServiceName>methodName formats
    const match = message.match(/^(\d{2}:\d{2}:\d{2})\s+\[(\w+)\s*\]\s+(.*)$/);
    
    if (match) {
        const [, timestamp, level, rest] = match;
        const levelUpper = level.toUpperCase();
        const levelColor = colors[level.toLowerCase()] || colors.white;
        
        // Check if rest starts with [operation] pattern (bright cyan)
        const operationMatch = rest.match(/^(\[[^\]]+\])(.*)$/);
        if (operationMatch) {
            const [, operation, remainder] = operationMatch;
            return `${colors.dim}${timestamp}${colors.reset} ${levelColor}[${levelUpper}]${colors.reset} ${colors.cyan}${colors.bright}${operation}${colors.reset}${remainder}`;
        }
        
        // Check if rest starts with Service>method pattern (magenta)
        const serviceMatch = rest.match(/^([^:]+>[^:]+)(.*)$/);
        if (serviceMatch) {
            const [, service, remainder] = serviceMatch;
            return `${colors.dim}${timestamp}${colors.reset} ${levelColor}[${levelUpper}]${colors.reset} ${colors.debug}${service}${colors.reset}${remainder}`;
        }
        
        // Default formatting if no special origin pattern
        return `${colors.dim}${timestamp}${colors.reset} ${levelColor}[${levelUpper}]${colors.reset} ${rest}`;
    }
    
    // If no match, return as-is
    return message;
};

const app = express();

// Middleware to parse different body types
// Order matters: more specific types first
app.use(express.json({ limit: '10mb', type: 'application/json' }));
app.use(express.text({ limit: '10mb', type: 'text/plain' }));
app.use(express.text({ limit: '10mb', type: '*/*' })); // Catch-all for other text types

// Helper to get short timestamp (HH:MM:SS)
const getShortTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // HH:MM:SS
};

// Health check endpoint - only for GET requests
app.get('/', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Remote log server is running',
        logFile: LOG_FILE,
        requests: requestCount
    });
});

// Handle POST requests to root path (same as /logs endpoint)
app.post('/', (req, res) => {
    requestCount++;
    
    try {
        let message;
        
        // Handle different content types - extract message
        if (typeof req.body === 'string' && req.body.trim()) {
            // Plain text from connector - use as-is
            message = req.body.trim();
        } else if (typeof req.body === 'object' && req.body) {
            // JSON payload - try to extract a message field, otherwise stringify
            message = req.body.message || req.body.msg || JSON.stringify(req.body);
        } else {
            message = String(req.body || '');
        }
        
        if (!message) {
            message = `${req.method} ${req.path} (empty body)`;
        }
        
        // Write to file (message already includes timestamp from connector)
        const logLine = `${message}\n`;
        fs.appendFileSync(LOG_FILE, logLine);
        
        // Print to console with colors - one line per message
        console.log(colorizeLog(message));
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error writing log:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

let requestCount = 0;

// Log endpoint - accepts any HTTP method
app.all('/logs', (req, res) => {
    requestCount++;
    
    try {
        let message;
        
        // Handle different content types - extract message
        if (typeof req.body === 'string' && req.body.trim()) {
            message = req.body.trim();
        } else if (typeof req.body === 'object' && req.body) {
            message = req.body.message || req.body.msg || JSON.stringify(req.body);
        } else {
            message = String(req.body || '');
        }
        
        if (!message) {
            message = `${req.method} ${req.path} (empty body)`;
        }
        
        // Write to file (message already includes timestamp from connector)
        const logLine = `${message}\n`;
        fs.appendFileSync(LOG_FILE, logLine);
        
        // Print to console with colors - one line per message
        console.log(colorizeLog(message));
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error writing log:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Catch-all endpoint for any other path
app.use((req, res) => {
    requestCount++;
    
    try {
        let message;
        
        // Handle different content types - prioritize body content
        if (typeof req.body === 'string' && req.body.trim()) {
            message = req.body.trim();
        } else if (typeof req.body === 'object' && req.body && Object.keys(req.body).length > 0) {
            message = req.body.message || req.body.msg || JSON.stringify(req.body);
        } else {
            // Only use method+path if there's no body content
            message = `${req.method} ${req.path}`;
        }
        
        const logLine = `${message}\n`;
        
        fs.appendFileSync(LOG_FILE, logLine);
        
        // Print full message to console with colors for real-time monitoring
        console.log(colorizeLog(message));
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error writing log:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`\n🚀 Remote log server listening on port ${PORT}`);
    console.log(`📝 Writing logs to: ${path.resolve(LOG_FILE)}`);
    console.log(`\nEndpoints:`);
    console.log(`  GET  /          - Health check`);
    console.log(`  POST /logs      - Send logs here`);
    console.log(`  *    *          - Any other request logs to file\n`);
});

server.on('error', (err) => {
    console.error('Server error:', err.message);
    process.exit(1);
});
