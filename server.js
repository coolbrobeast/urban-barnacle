import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

let db;

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Database setup ---
async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, "chat.db"),
    driver: sqlite3.Database,
  });

  // Messages table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      text TEXT NOT NULL,
      time TEXT NOT NULL,
      recipient TEXT
    );
  `);

  // Status table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS status (
      user TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      message TEXT
    );
  `);

  console.log("✅ Database ready");
}

// --- API Endpoints ---

// Send a message
app.post("/send", async (req, res) => {
  const { user, text, recipient } = req.body;
  if (!user || !text) return res.status(400).send("User and text required");

  const time = new Date().toISOString();
  try {
    await db.run(
      "INSERT INTO messages (user, text, time, recipient) VALUES (?, ?, ?, ?)",
      [user, text, time, recipient || ""]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending message");
  }
});

// Fetch messages (public or private)
app.get("/messages", async (req, res) => {
  const currentUser = req.query.user || "";
  try {
    const msgs = await db.all(
      `SELECT * FROM messages 
       WHERE recipient = '' OR recipient = ? OR user = ?
       ORDER BY id ASC`,
      [currentUser, currentUser]
    );
    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching messages");
  }
});

// Set user status
app.post("/status", async (req, res) => {
  const { user, status, message } = req.body;
  if (!user || !status) return res.status(400).send("User and status required");

  try {
    await db.run(
      `INSERT OR REPLACE INTO status (user, status, message) VALUES (?, ?, ?)`,
      [user, status, message || ""]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error setting status");
  }
});

// Fetch statuses for multiple users
app.get("/status", async (req, res) => {
  const userList = req.query.users;
  if (!userList) return res.json([]);

  const users = userList.split(",");
  const placeholders = users.map(() => "?").join(",");

  try {
    const statuses = await db.all(
      `SELECT user, status, message FROM status WHERE user IN (${placeholders})`,
      users
    );
    res.json(statuses);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching statuses");
  }
});

// --- Serve frontend ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Start server ---
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
  });
