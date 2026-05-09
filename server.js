// ===========================================
// CAR REPAIR BOOKING SYSTEM - SERVER
// ===========================================

const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");
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
console.log("   SENDGRID_API = '" + (process.env.SENDGRID_API_KEY ? "✅ Gesetzt (" + process.env.SENDGRID_API_KEY.substring(0, 8) + "...)" : "❌ NICHT GESETZT") + "'");
console.log("");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- SET UP SQLITE DATABASE ---
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

// --- SET UP EMAIL TRANSPORT ---
// Use SendGrid if API key is available, otherwise fallback to SMTP
let useSendGrid = false;
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  useSendGrid = true;
  console.log("✅ Using SendGrid for email delivery");
}

// Nodemailer SMTP as fallback (works locally, not on Railway)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 5000,
  greetingTimeout: 5000
});

// --- HELPER: Send email (SendGrid or SMTP) ---
function sendEmail(to, subject, text) {
  return new Promise((resolve, reject) => {
    if (useSendGrid) {
      // Send via SendGrid API (works everywhere)
      const msg = {
        to: to,
        from: process.env.EMAIL_USER,
        subject: subject,
        text: text
      };
      sgMail.send(msg)
        .then(() => {
          console.log("✅ Email sent via SendGrid to:", to);
          resolve();
        })
        .catch(err => {
          console.error("❌ SendGrid error:", err.message);
          reject(err);
        });
    } else {
      // Send via SMTP (only works on local machine)
      transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: to,
        subject: subject,
        text: text
      }, (mailErr, info) => {
        if (mailErr) {
          console.error("❌ SMTP email error:", mailErr.message);
          reject(mailErr);
        } else {
          console.log("✅ Email sent via SMTP to:", to);
          resolve(info);
        }
      });
    }
  });
}

// --- DEBUG ROUTE ---
app.get("/api/test", (req, res) => {
  res.json({
    status: "ok",
    env: {
      email_user_set: !!process.env.EMAIL_USER,
      email_pass_set: !!process.env.EMAIL_PASS,
      sendgrid_set: !!process.env.SENDGRID_API_KEY,
      use_sendgrid: useSendGrid,
      notification: process.env.NOTIFICATION_EMAIL
    }
  });
});

// --- TEST EMAIL ROUTE ---
app.get("/api/test-email", async (req, res) => {
  try {
    await sendEmail(
      process.env.NOTIFICATION_EMAIL || process.env.EMAIL_USER,
      "🔧 Test-E-Mail von E Car Doctor",
      "Diese E-Mail bestätigt, dass der E-Mail-Dienst funktioniert."
    );
    res.json({ success: true, method: useSendGrid ? "SendGrid" : "SMTP" });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// --- API ROUTE: POST /api/book ---
app.post("/api/book", async (req, res) => {
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

    // STEP 2: Send emails (don't wait for them)
    sendEmail(
      email,
      "✅ Buchung bestätigt - E Car Doctor",
      `Hallo ${customer_name},\n\nIhre Buchung wurde erfolgreich bestätigt!\n\n📋 Service: ${service_type}\n🚗 Fahrzeug: ${car_model}\n📅 Termin: ${booking_date}\n\nWir freuen uns auf Ihren Besuch!\n\nMit freundlichen Grüßen,\nIhr E Car Doctor-Team`
    ).catch(() => {});

    sendEmail(
      process.env.NOTIFICATION_EMAIL || "ecardoctor3@gmail.com",
      "🔔 Neue Buchung - E Car Doctor",
      `Neue Buchung eingegangen:\n\n👤 Kunde: ${customer_name}\n📧 E-Mail: ${email}\n📞 Telefon: ${phone}\n🚗 Fahrzeug: ${car_model}\n🔧 Service: ${service_type}\n📅 Termin: ${booking_date}\n\nBitte bestätigen Sie den Termin.`
    ).catch(() => {});

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
  }
  if (useSendGrid) {
    console.log("✅ SendGrid ist konfiguriert - E-Mails werden über API gesendet");
  } else {
    console.log("⚠️  SendGrid nicht konfiguriert. Setze SENDGRID_API_KEY für E-Mails auf Railway.");
  }
});