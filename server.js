// ===========================================
// CAR REPAIR BOOKING SYSTEM - SERVER
// ===========================================

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const path = require("path");

require("dotenv").config();

// Normalize env variable names
if (process.env.GMAIL_USER && !process.env.EMAIL_USER) {
  process.env.EMAIL_USER = process.env.GMAIL_USER;
}
if (process.env.GMAIL_APP_PASS && !process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = process.env.GMAIL_APP_PASS;
}
if (process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = process.env.EMAIL_PASS.replace(/\s+/g, "");
}

console.log("🧪 ENV Test — Zeige geladene Zugangsdaten:");
console.log("   EMAIL_USER   = '" + (process.env.EMAIL_USER || "❌ NICHT GESETZT") + "'");
console.log("   EMAIL_PASS   = '" + (process.env.EMAIL_PASS || "❌ NICHT GESETZT") + "'  (" + (process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length + " Zeichen)" : "0 Zeichen)"));
console.log("   NOTIFICATION = '" + (process.env.NOTIFICATION_EMAIL || "(nicht gesetzt)") + "'");
console.log("");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- SET UP SQLITE DATABASE (better-sqlite3) ---
const db = new Database(path.join(__dirname, "public", "database.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    car_model TEXT NOT NULL,
    service_type TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

// --- SET UP NODEMAILER ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// --- DEBUG ROUTE: GET /api/test ---
app.get("/api/test", (req, res) => {
  res.json({ status: "ok", env: { email_user: !!process.env.EMAIL_USER, notification: process.env.NOTIFICATION_EMAIL } });
});

// --- API ROUTE: POST /api/book ---
app.post("/api/book", (req, res) => {
  const { customer_name, email, phone, car_model, service_type, booking_date } = req.body;

  if (!customer_name || !email || !phone || !car_model || !service_type || !booking_date) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich!" });
  }

  try {
    // STEP 1: Save booking into SQLite
    const stmt = db.prepare(`INSERT INTO bookings (customer_name, email, phone, car_model, service_type, booking_date)
                             VALUES (?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(customer_name, email, phone, car_model, service_type, booking_date);
    const bookingId = info.lastInsertRowid;

    // STEP 2: Send email notifications
    const customerMailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "✅ Buchung bestätigt - E Car Doctor",
      text: `Hallo ${customer_name},

Ihre Buchung wurde erfolgreich bestätigt!

📋 Service: ${service_type}
🚗 Fahrzeug: ${car_model}
📅 Termin: ${booking_date}

Wir freuen uns auf Ihren Besuch!

Mit freundlichen Grüßen,
Ihr E Car Doctor-Team`
    };

    const workshopMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || "ecardoctor3@gmail.com",
      subject: "🔔 Neue Buchung - E Car Doctor",
      text: `Neue Buchung eingegangen:

👤 Kunde: ${customer_name}
📧 E-Mail: ${email}
📞 Telefon: ${phone}
🚗 Fahrzeug: ${car_model}
🔧 Service: ${service_type}
📅 Termin: ${booking_date}

Bitte bestätigen Sie den Termin.`
    };

    // Send emails asynchronously
    transporter.sendMail(customerMailOptions, (mailErr, info) => {
      if (mailErr) {
        console.error("❌ Customer email error:", mailErr.message);
      } else {
        console.log("✅ Confirmation email sent to customer:", email);
      }
    });

    transporter.sendMail(workshopMailOptions, (mailErr, info) => {
      if (mailErr) {
        console.error("❌ Workshop email error:", mailErr.message);
      } else {
        console.log("✅ Notification email sent to workshop");
      }
    });

    res.json({
      success: true,
      bookingId: bookingId,
      message: "✅ Buchung gespeichert! Bestätigungs-E-Mail wird versendet."
    });

  } catch (err) {
    console.error("Datenbankfehler:", err.message);
    return res.status(500).json({ error: "Buchung fehlgeschlagen." });
  }
});

// --- START THE SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("🚗 E Car Doctor - Server läuft");
  console.log(`   http://localhost:${PORT}`);
  console.log("");

  if (process.env.EMAIL_USER && process.env.EMAIL_USER !== "your-email@gmail.com") {
    console.log("✅ EMAIL_USER ist konfiguriert");
  } else {
    console.log("⚠️  EMAIL_USER nicht gesetzt.");
  }

  if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "your-app-password") {
    console.log("✅ EMAIL_PASS ist konfiguriert");
  } else {
    console.log("⚠️  EMAIL_PASS nicht gesetzt.");
  }

  console.log("");

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS &&
      process.env.EMAIL_USER !== "your-email@gmail.com" &&
      process.env.EMAIL_PASS !== "your-app-password") {
    transporter.verify((verifyErr) => {
      if (verifyErr) {
        console.log("❌ SMTP-Verbindungsfehler:", verifyErr.message);
      } else {
        console.log("✅ SMTP-Verbindung zu Gmail hergestellt – bereit für E-Mails.");
      }
    });
  }
});