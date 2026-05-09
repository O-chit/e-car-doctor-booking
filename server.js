// ===========================================
// CAR REPAIR BOOKING SYSTEM - SERVER (sql.js)
// ===========================================

const express = require("express");
const cors = require("cors");
const initSqlJs = require("sql.js");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

if (process.env.GMAIL_USER && !process.env.EMAIL_USER) process.env.EMAIL_USER = process.env.GMAIL_USER;
if (process.env.GMAIL_APP_PASS && !process.env.EMAIL_PASS) process.env.EMAIL_PASS = process.env.GMAIL_APP_PASS;
if (process.env.EMAIL_PASS) process.env.EMAIL_PASS = process.env.EMAIL_PASS.replace(/\s+/g, "");

console.log("🚗 E Car Doctor Server starting...");
console.log("   EMAIL_USER =", process.env.EMAIL_USER ? "✅" : "❌");
console.log("   EMAIL_PASS =", process.env.EMAIL_PASS ? "✅ (" + process.env.EMAIL_PASS.length + " chars)" : "❌");
console.log("   NOTIFICATION_EMAIL =", process.env.NOTIFICATION_EMAIL || "❌");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
let db;
const DB_PATH = path.join(__dirname, "public", "database.db");

async function initDb() {
  const SQL = await initSqlJs();
  
  // Try to load existing database file
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
    car_model TEXT NOT NULL, service_type TEXT NOT NULL, booking_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Save to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Email transporter
let transporter;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: { rejectUnauthorized: false }
  });
}

// API: POST /api/book
app.post("/api/book", (req, res) => {
  const { customer_name, email, phone, car_model, service_type, booking_date } = req.body;
  
  if (!customer_name || !email || !phone || !car_model || !service_type || !booking_date) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich!" });
  }

  try {
    // Save booking
    db.run(`INSERT INTO bookings (customer_name, email, phone, car_model, service_type, booking_date) VALUES (?, ?, ?, ?, ?, ?)`,
      [customer_name, email, phone, car_model, service_type, booking_date]);
    
    // Get the ID
    const result = db.exec("SELECT last_insert_rowid()");
    const bookingId = result[0].values[0][0];
    
    // Save database to file
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));

    // Send emails if transporter is available
    if (transporter) {
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "✅ Buchung bestätigt - E Car Doctor",
        text: `Hallo ${customer_name},\n\nIhre Buchung wurde bestätigt!\n\nService: ${service_type}\nFahrzeug: ${car_model}\nTermin: ${booking_date}\n\nWir freuen uns auf Ihren Besuch!\n\nIhr E Car Doctor-Team`
      }, (err) => { if (err) console.error("❌ Email error:", err ? err.message : "unknown"); });

      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_EMAIL || email,
        subject: "🔔 Neue Buchung - E Car Doctor",
        text: `Neue Buchung:\n\nKunde: ${customer_name}\nEmail: ${email}\nTelefon: ${phone}\nFahrzeug: ${car_model}\nService: ${service_type}\nTermin: ${booking_date}`
      }, (err) => { if (err) console.error("❌ Workshop email error:", err ? err.message : "unknown"); });
    }

    res.json({ success: true, bookingId, message: "✅ Buchung gespeichert!" });
  } catch (err) {
    console.error("❌ DB error:", err.message);
    return res.status(500).json({ error: "Buchung fehlgeschlagen." });
  }
});

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log("=================================");
    console.log("🚗 E Car Doctor - Server läuft");
    console.log("   http://localhost:" + PORT);
    console.log("=================================");
  });
}).catch(err => {
  console.error("❌ Failed to init DB:", err.message);
  process.exit(1);
});