// ===========================================
// CAR REPAIR BOOKING - FRONTEND LOGIC
// ===========================================
// This file handles the form submission:
// 1. Collects form data
// 2. Sends it to the server
// 3. Shows success/error messages

// Wait for the HTML to fully load before running any code
document.addEventListener("DOMContentLoaded", function () {

  // --- Get references to HTML elements ---
  const form = document.getElementById("bookingForm");
  const submitBtn = document.getElementById("submitBtn");
  const messageDiv = document.getElementById("message");

  // --- Set min date to today (can't book in the past) ---
  const dateInput = document.getElementById("booking_date");
  const today = new Date().toISOString().split("T")[0]; // Gets "YYYY-MM-DD"
  dateInput.setAttribute("min", today);

  // --- Listen for form submission ---
  form.addEventListener("submit", async function (event) {
    // Stop the page from reloading when the form is submitted
    event.preventDefault();

    // --- Collect all form field values ---
    const customer_name = document.getElementById("customer_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const car_model = document.getElementById("car_model").value.trim();
    const service_type = document.getElementById("service_type").value;
    const booking_date = document.getElementById("booking_date").value;

    // --- Validate: check no empty fields ---
    if (!customer_name || !email || !phone || !car_model || !service_type || !booking_date) {
      showMessage("Bitte füllen Sie alle Felder aus.", "error");
      return;
    }

    // --- Disable button while submitting ---
    submitBtn.disabled = true;
    submitBtn.textContent = "Wird gebucht...";

    try {
      // --- Send data to the server via POST request ---
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customer_name,
          email: email,
          phone: phone,
          car_model: car_model,
          service_type: service_type,
          booking_date: booking_date
        })
      });

      // --- Parse the response from the server ---
      const data = await response.json();

      if (data.success) {
        // Show success message
        showMessage(data.message, "success");
        // Reset the form fields
        form.reset();
      } else {
        // Show error from server
        showMessage(data.error || "Etwas ist schiefgelaufen.", "error");
      }
    } catch (error) {
      // If the server is not running
      showMessage("Keine Verbindung zum Server. Stellen Sie sicher, dass der Server läuft!", "error");
      console.error("Error:", error);
    } finally {
      // --- Re-enable the button ---
      submitBtn.disabled = false;
      submitBtn.textContent = "📅 Termin buchen";
    }
  });

  // --- Helper: Show a message (success or error) ---
  function showMessage(text, type) {
    messageDiv.textContent = text;          // Set the text
    messageDiv.className = "message " + type; // Add the CSS class (success or error)
  }

});