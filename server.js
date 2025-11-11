import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";

const app = express();
const port = 3000;
let db;

// --- 1. Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- 2. Database Initialization ---
async function initializeDatabase() {
    try {
        db = await open({
            filename: "./chat.db",
            driver: sqlite3.Database
        });
        
        // 1. Messages table (existing)
        await db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                user TEXT NOT NULL, 
                text TEXT NOT NULL, 
                time TEXT NOT NULL,
                recipient TEXT
            );
        `);

        // 2. NEW: Status table
        await db.exec(`
            CREATE TABLE IF NOT EXISTS status (
                user TEXT PRIMARY KEY, 
                status TEXT NOT NULL,
                message TEXT
            );
        `);
        
        console.log('✅ Database connected and tables ready.');
    } catch (err) {
        console.error("❌ FATAL: Could not connect to or initialize the database.", err);
        throw err; 
    }
}


// --- 3. API Endpoints ---

// POST: Send a message
app.post("/send", async (req, res) => {
    const { user, text, recipient } = req.body; 
    const time = new Date().toISOString();
    
    if (!user || !text) {
        return res.status(400).send("User and text are required.");
    }

    try {
        await db.run("INSERT INTO messages (user, text, time, recipient) VALUES (?, ?, ?, ?)", [user, text, time, recipient || '']); 
        res.sendStatus(200);
    } catch (err) {
        console.error("Error inserting message:", err);
        res.status(500).send("Internal Server Error during message insert. Check server console for details.");
    }
});

// GET: Fetch relevant messages (Public OR Private to the requested user)
app.get("/messages", async (req, res) => {
    const currentUser = req.query.user || ''; 
    
    try {
        // Fetch messages that are public (recipient='') OR involve the currentUser (as recipient or sender)
        const msgs = await db.all(
            `SELECT * FROM messages 
             WHERE recipient = '' OR recipient = ? OR user = ? 
             ORDER BY id ASC`, 
            [currentUser, currentUser]
        );
        res.json(msgs);
    } catch (err) {
        console.error("Error fetching messages:", err);
        res.status(500).send("Internal Server Error during message fetch.");
    }
});

// server.js (Ensure this code exists and is correct)

// NEW POST: Set user status
app.post("/status", async (req, res) => {
    // ... your status update logic here ...
    const { user, status, message } = req.body;
    
    if (!user || !status) {
        return res.status(400).send("User and status are required.");
    }

    try {
        // Use INSERT OR REPLACE to either insert a new row or update the existing one
        await db.run(
            `INSERT OR REPLACE INTO status (user, status, message) 
             VALUES (?, ?, ?)`, 
            [user, status, message || '']
        );
        res.sendStatus(200);
    } catch (err) {
        console.error("Error setting status:", err);
        res.status(500).send("Internal Server Error during status update.");
    }
});

// NEW GET: Fetch status for a list of users
app.get("/status", async (req, res) => {
    const userList = req.query.users; // Comma-separated list of users from the client
    
    if (!userList) {
        return res.json([]); // Return empty array if no users are requested
    }
    
    // Create a list of placeholders (e.g., ?, ?, ?) and an array of user names
    const users = userList.split(',');
    const placeholders = users.map(() => '?').join(',');

    try {
        // Select status only for the requested users
        const statuses = await db.all(
            `SELECT user, status, message FROM status WHERE user IN (${placeholders})`,
            users
        );
        res.json(statuses);
    } catch (err) {
        console.error("Error fetching statuses:", err);
        res.status(500).send("Internal Server Error during status fetch.");
    }
});


// --- 4. Server Start ---
initializeDatabase().then(() => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Chat server listening at http://localhost:${port}`);
    });
}).catch(err => {
    console.error("Server failed to start due to database error:", err);
});