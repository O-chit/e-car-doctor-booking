// ===========================================
// CAR REPAIR BOOKING SYSTEM - SERVER
// ===========================================
// This is the backend server that:
// 1. Serves the website (HTML, CSS, JS)
// 2. Saves bookings into SQLite database
// 3. Sends email notifications via Nodemailer

// --- IMPORT MODULES ---
const express = require("express");      // Web framework
const cors = require("cors");            // Cross-origin requests
const sqlite3 = require("sqlite3");      // Database
const nodemailer = require("nodemailer"); // Email sender
const path = require("path");            // File paths
const dotenv = require("dotenv");        // Environment variables

// --- LOAD ENVIRONMENT VARIABLES from .env file ---
// dotenv reads the .env file and puts all values into process.env
// The .env file must be in the same folder as this server.js file
require("dotenv").config();

// --- Normalize env variable names (support old + new) ---
// If the .env still uses old names (GMAIL_USER, GMAIL_APP_PASS),
// map them to the new names (EMAIL_USER, EMAIL_PASS)
if (process.env.GMAIL_USER && !process.env.EMAIL_USER) {
  process.env.EMAIL_USER = process.env.GMAIL_USER;
}
if (process.env.GMAIL_APP_PASS && !process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = process.env.GMAIL_APP_PASS;
}

// --- Remove any spaces from the App Password ---
// Gmail App Passwords may contain spaces (e.g. "abcd efgh ijkl mnop")
// Nodemailer needs them removed
if (process.env.EMAIL_PASS) {
  process.env.EMAIL_PASS = process.env.EMAIL_PASS.replace(/\s+/g, "");
}

// Debug: Show environment variables that are loaded (for troubleshooting)
console.log("🧪 ENV Test — Zeige geladene Zugangsdaten:");
console.log("   EMAIL_USER   = '" + (process.env.EMAIL_USER || "❌ NICHT GESETZT") + "'");
console.log("   EMAIL_PASS   = '" + (process.env.EMAIL_PASS || "❌ NICHT GESETZT") + "'  (" + (process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length + " Zeichen)" : "0 Zeichen)"));
console.log("   NOTIFICATION = '" + (process.env.NOTIFICATION_EMAIL || "(nicht gesetzt)") + "'");
console.log("");
console.log("⚠️  Hinweis: Ein gültiges Gmail App-Passwort hat genau 16 Zeichen (z.B. abcd efgh ijkl mnop)");
console.log("");

// --- CREATE THE APP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors());                    // Allow other domains to connect
app.use(express.json());            // Read JSON from requests
app.use(express.static(path.join(__dirname, "public"))); // Serve static files

// --- SET UP SQLITE DATABASE ---
const db = new sqlite3.Database(path.join(__dirname, "public", "database.db"));

// Create the bookings table (if it doesn't exist yet)
db.run(`
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

// --- SET UP NODEMAILER (Gmail) ---
// Reads credentials from .env file (see .env.example for setup)
//
// To get a Gmail App Password:
//   1. Enable 2-Step Verification in your Google Account
//   2. Go to Security → App passwords
//   3. Select "Mail" and generate a 16-character password
//   4. Put it in .env as EMAIL_PASS (spaces are removed automatically)
//
// Using service: 'gmail' tells Nodemailer to use Gmail's SMTP settings
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,   // Your Gmail address from .env
    pass: process.env.EMAIL_PASS    // Your Gmail App Password from .env
  },
  // Fix SSL certificate issues (common on some networks)
  tls: {
    rejectUnauthorized: false
  }
});

// --- API ROUTE: POST /api/book ---
// This is called when the user submits the booking form
app.post("/api/book", (req, res) => {
  // Grab the form data from the request
  const { customer_name, email, phone, car_model, service_type, booking_date } = req.body;

  // Make sure all fields are filled in
  if (!customer_name || !email || !phone || !car_model || !service_type || !booking_date) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich!" });
  }

  // ===== STEP 1: Save booking into SQLite =====
  const sql = `INSERT INTO bookings (customer_name, email, phone, car_model, service_type, booking_date)
               VALUES (?, ?, ?, ?, ?, ?)`;

  db.run(sql, [customer_name, email, phone, car_model, service_type, booking_date], function (err) {
    if (err) {
    console.error("Datenbankfehler:", err.message);
      return res.status(500).json({ error: "Buchung fehlgeschlagen." });
    }

    // ===== STEP 2: Send email notifications =====

    // --- Email to the customer (booking confirmation) ---
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

    // --- Email to the workshop (booking notification) ---
    const workshopMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || "ecardoctor04@gmail.com",
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

    // Send email to the customer
    transporter.sendMail(customerMailOptions, (mailErr, info) => {
      if (mailErr) {
        console.error("❌ Customer email error:", mailErr.message);
        console.error("   Full error:", JSON.stringify(mailErr, null, 2));
      } else {
        console.log("✅ Confirmation email sent to customer:", email);
        console.log("   Message ID:", info.messageId);
        console.log("   Response:", info.response);
      }
    });

    // Send email to the workshop (ecardoctor3@gmail.com)
    transporter.sendMail(workshopMailOptions, (mailErr, info) => {
      if (mailErr) {
        console.error("❌ Workshop email error:", mailErr.message);
        console.error("   Full error:", JSON.stringify(mailErr, null, 2));
      } else {
        console.log("✅ Notification email sent to workshop");
        console.log("   Message ID:", info.messageId);
        console.log("   Response:", info.response);
      }
    });

    // Always return success (email errors are logged but don't block the booking)
    res.json({
      success: true,
      bookingId: this.lastID,
      message: "✅ Buchung gespeichert! Bestätigungs-E-Mail wird versendet."
    });
  });
});

// --- START THE SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("");
  console.log("🚗 E Car Doctor - Server läuft");
  console.log(`   http://localhost:${PORT}`);
  console.log("");

  // Check if email credentials are configured
  if (process.env.EMAIL_USER && process.env.EMAIL_USER !== "your-email@gmail.com") {
    console.log("✅ EMAIL_USER ist konfiguriert");
  } else {
    console.log("⚠️  EMAIL_USER nicht gesetzt. Kopiere .env.example → .env und trage deine Daten ein.");
  }

  if (process.env.EMAIL_PASS && process.env.EMAIL_PASS !== "your-app-password") {
    console.log("✅ EMAIL_PASS ist konfiguriert");
  } else {
    console.log("⚠️  EMAIL_PASS nicht gesetzt. Erstelle ein Gmail App-Passwort.");
  }

  console.log("");

  // Verify the SMTP connection (optional, only if credentials are set)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS &&
      process.env.EMAIL_USER !== "your-email@gmail.com" &&
      process.env.EMAIL_PASS !== "your-app-password") {
    transporter.verify((verifyErr) => {
      if (verifyErr) {
        console.log("❌ SMTP-Verbindungsfehler:", verifyErr.message);
        console.log("   Tipp: Prüfe EMAIL_USER und EMAIL_PASS in der .env-Datei.");
      } else {
        console.log("✅ SMTP-Verbindung zu Gmail hergestellt – bereit für E-Mails.");
      }
    });
  }
});
