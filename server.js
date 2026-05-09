// ===========================================
// CAR REPAIR BOOKING SYSTEM - SERVER
// ===========================================

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");

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

// Database
const db = new Database(path.join(__dirname, "public", "database.db"));
db.exec(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
  car_model TEXT NOT NULL, service_type TEXT NOT NULL, booking_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`);

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

// API: POST /api/book
app.post("/api/book", (req, res) => {
  const { customer_name, email, phone, car_model, service_type, booking_date } = req.body;
  
  if (!customer_name || !email || !phone || !car_model || !service_type || !booking_date) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich!" });
  }

  try {
    const stmt = db.prepare(`INSERT INTO bookings (customer_name, email, phone, car_model, service_type, booking_date) VALUES (?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(customer_name, email, phone, car_model, service_type, booking_date);

    // Send emails (async)
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "✅ Buchung bestätigt - E Car Doctor",
      text: `Hallo ${customer_name},\n\nIhre Buchung wurde bestätigt!\n\nService: ${service_type}\nFahrzeug: ${car_model}\nTermin: ${booking_date}\n\nWir freuen uns auf Ihren Besuch!\n\nIhr E Car Doctor-Team`
    }, (err) => { if (err) console.error("❌ Email error:", err.message); else console.log("✅ Email sent to", email); });

    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || "ecardoctor3@gmail.com",
      subject: "🔔 Neue Buchung - E Car Doctor",
      text: `Neue Buchung:\n\nKunde: ${customer_name}\nEmail: ${email}\nTelefon: ${phone}\nFahrzeug: ${car_model}\nService: ${service_type}\nTermin: ${booking_date}`
    }, (err) => { if (err) console.error("❌ Workshop email error:", err.message); else console.log("✅ Workshop notified"); });

    res.json({ success: true, bookingId: info.lastInsertRowid, message: "✅ Buchung gespeichert!" });
  } catch (err) {
    console.error("❌ DB error:", err.message);
    return res.status(500).json({ error: "Buchung fehlgeschlagen." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=================================");
  console.log("🚗 E Car Doctor - Server läuft");
  console.log("   http://localhost:" + PORT);
  console.log("=================================");
});