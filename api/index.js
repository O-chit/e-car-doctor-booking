const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

// In-memory database (Vercel serverless)
const bookings = [];
let nextId = 1;

// Email transporter
let transporter = null;
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

  const bookingId = nextId++;
  const booking = { id: bookingId, customer_name, email, phone, car_model, service_type, booking_date, created_at: new Date().toISOString() };
  bookings.push(booking);

  // Send emails
  if (transporter) {
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "✅ Buchung bestätigt - E Car Doctor",
      text: `Hallo ${customer_name},\n\nIhre Buchung wurde bestätigt!\n\nService: ${service_type}\nFahrzeug: ${car_model}\nTermin: ${booking_date}\n\nWir freuen uns auf Ihren Besuch!\n\nIhr E Car Doctor-Team`
    }).catch(err => console.error("Email error:", err.message));

    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || email,
      subject: "🔔 Neue Buchung - E Car Doctor",
      text: `Neue Buchung:\n\nKunde: ${customer_name}\nEmail: ${email}\nTelefon: ${phone}\nFahrzeug: ${car_model}\nService: ${service_type}\nTermin: ${booking_date}`
    }).catch(err => console.error("Workshop email error:", err.message));
  }

  res.json({ success: true, bookingId, message: "✅ Buchung gespeichert!" });
});

// Export for Vercel
module.exports = app;