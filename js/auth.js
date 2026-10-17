import { supabase } from "./supabaseClient.js";

const msgEl      = document.getElementById("auth-msg");
const loginForm  = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const tabs       = document.querySelectorAll(".tab");

function showMessage(text, type = "error") {
  msgEl.textContent = text;
  msgEl.className = "msg" + (text ? " " + type : "");
}

function switchTab(name) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  loginForm.classList.toggle("hidden", name !== "login");
  signupForm.classList.toggle("hidden", name !== "signup");
  showMessage("");
}

tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

/* Already logged in? Go straight to chat. */
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) location.replace("chat.html");
})();

/* ---------------- Log in ---------------- */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  showMessage("Signing in…", "info");
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage(error.message, "error");
    return;
  }
  location.replace("chat.html");
});

/* ---------------- Sign up ---------------- */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("signup-username").value.trim();
  const email    = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
    showMessage("Username must be 3–20 letters, numbers or underscores.", "error");
    return;
  }

  showMessage("Checking username…", "info");
  const { data: available, error: rpcError } = await supabase.rpc(
    "username_available",
    { p_username: username }
  );

  if (rpcError) {
    showMessage(rpcError.message, "error");
    return;
  }
  if (!available) {
    showMessage("That username is already taken.", "error");
    return;
  }

  showMessage("Creating account…", "info");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  if (!data.session) {
    // Email confirmation is enabled
    switchTab("login");
    document.getElementById("login-email").value = email;
    showMessage("Account created! Confirm your email, then log in.", "success");
    return;
  }

  location.replace("chat.html");
});