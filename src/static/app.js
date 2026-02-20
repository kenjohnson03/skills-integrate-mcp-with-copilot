// ─── Auth State ───────────────────────────────────────────────────────────────
let authToken = localStorage.getItem("authToken");
let authUsername = localStorage.getItem("authUsername");

// ─── Auth UI ──────────────────────────────────────────────────────────────────
window.toggleLoginModal = function () {
  const modal = document.getElementById("login-modal");
  modal.classList.toggle("hidden");
  if (!modal.classList.contains("hidden")) {
    document.getElementById("username").focus();
  }
};

function updateAuthUI() {
  const authBtn = document.getElementById("auth-btn");
  const authStatus = document.getElementById("auth-status");
  const signupContainer = document.getElementById("signup-container");

  if (authToken) {
    authStatus.textContent = `👤 ${authUsername}`;
    authBtn.textContent = "Logout";
    authBtn.onclick = handleLogout;
    signupContainer.classList.remove("hidden");
  } else {
    authStatus.textContent = "";
    authBtn.textContent = "🔑 Teacher Login";
    authBtn.onclick = toggleLoginModal;
    signupContainer.classList.add("hidden");
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function handleLogout() {
  try {
    await fetch("/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
  } catch (_) {
    // Ignore errors on logout
  }
  authToken = null;
  authUsername = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUsername");
  updateAuthUI();
  fetchActivities();
}

// ─── Activities ───────────────────────────────────────────────────────────────
async function fetchActivities() {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");

  try {
    const response = await fetch("/activities");
    const activities = await response.json();

    // Clear loading message and dropdown options
    activitiesList.innerHTML = "";
    activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

    // Populate activities list
    Object.entries(activities).forEach(([name, details]) => {
      const activityCard = document.createElement("div");
      activityCard.className = "activity-card";

      const spotsLeft = details.max_participants - details.participants.length;

      // Only show delete buttons when logged in as a teacher
      const participantsHTML =
        details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li>
                        <span class="participant-email">${email}</span>
                        ${authToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""}
                      </li>`
                  )
                  .join("")}
              </ul>
            </div>`
          : `<p><em>No participants yet</em></p>`;

      activityCard.innerHTML = `
        <h4>${name}</h4>
        <p>${details.description}</p>
        <p><strong>Schedule:</strong> ${details.schedule}</p>
        <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
        <div class="participants-container">
          ${participantsHTML}
        </div>
      `;

      activitiesList.appendChild(activityCard);

      // Add option to select dropdown
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      activitySelect.appendChild(option);
    });

    // Add event listeners to delete buttons
    document.querySelectorAll(".delete-btn").forEach((button) => {
      button.addEventListener("click", handleUnregister);
    });
  } catch (error) {
    activitiesList.innerHTML =
      "<p>Failed to load activities. Please try again later.</p>";
    console.error("Error fetching activities:", error);
  }
}

// ─── Unregister ───────────────────────────────────────────────────────────────
async function handleUnregister(event) {
  const button = event.target;
  const activity = button.getAttribute("data-activity");
  const email = button.getAttribute("data-email");
  const messageDiv = document.getElementById("message");

  try {
    const response = await fetch(
      `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    const result = await response.json();

    if (response.ok) {
      messageDiv.textContent = result.message;
      messageDiv.className = "success";
      fetchActivities();
    } else {
      messageDiv.textContent = result.detail || "An error occurred";
      messageDiv.className = "error";
    }

    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  } catch (error) {
    messageDiv.textContent = "Failed to unregister. Please try again.";
    messageDiv.className = "error";
    messageDiv.classList.remove("hidden");
    console.error("Error unregistering:", error);
  }
}

// ─── Initialization ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Login form submission
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const loginError = document.getElementById("login-error");

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );
      const result = await response.json();
      if (response.ok) {
        authToken = result.token;
        authUsername = result.username;
        localStorage.setItem("authToken", authToken);
        localStorage.setItem("authUsername", authUsername);
        document.getElementById("login-modal").classList.add("hidden");
        document.getElementById("login-form").reset();
        loginError.classList.add("hidden");
        updateAuthUI();
        fetchActivities();
      } else {
        loginError.textContent = result.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch (err) {
      loginError.textContent = "Login request failed. Please try again.";
      loginError.classList.remove("hidden");
    }
  });

  // Close modal when clicking the backdrop
  document.getElementById("login-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("login-modal")) {
      toggleLoginModal();
    }
  });

  // Sign up form submission
  document.getElementById("signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const messageDiv = document.getElementById("message");
    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        document.getElementById("signup-form").reset();
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");
      setTimeout(() => messageDiv.classList.add("hidden"), 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
