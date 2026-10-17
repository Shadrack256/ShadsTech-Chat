import { supabase } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);
const appEl = document.querySelector(".app");

let me     = null;   // { id, username }
let contacts = [];
let active = null;   // currently open contact
const renderedIds = new Set();  // avoid duplicate bubbles
const previews    = {};         // contactId -> last message text

/* ================= BOOT ================= */
async function boot() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.replace("index.html");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", session.user.id)
    .single();

  me = profile || {
    id: session.user.id,
    username: session.user.email.split("@")[0],
  };

  $("me-name").textContent   = me.username;
  $("me-avatar").textContent = me.username[0].toUpperCase();

  await loadContacts();
  subscribeRealtime();

  // Optional deep-link: chat.html?u=<user-id>
  const wanted = new URLSearchParams(location.search).get("u");
  if (wanted) {
    const c = contacts.find((x) => x.id === wanted);
    if (c) openChat(c);
  }
}

/* ================= CONTACTS ================= */
async function loadContacts() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .neq("id", me.id)
    .order("username", { ascending: true });

  if (error) {
    console.error("loadContacts:", error);
    return;
  }
  contacts = data || [];
  renderContacts($("search").value);
}

function renderContacts(filter = "") {
  const list = $("contact-list");
  list.innerHTML = "";

  const q = filter.trim().toLowerCase();
  const shown = contacts.filter((c) => c.username.toLowerCase().includes(q));

  $("contacts-empty").classList.toggle("hidden", contacts.length > 0);

  for (const c of shown) {
    const li = document.createElement("li");
    li.className = "contact" + (active && active.id === c.id ? " active" : "");

    const av = document.createElement("div");
    av.className = "avatar";
    av.textContent = c.username[0].toUpperCase();

    const info = document.createElement("div");
    info.className = "contact-info";

    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = c.username;

    const preview = document.createElement("div");
    preview.className = "contact-preview";
    preview.textContent = previews[c.id] || "Say hi 👋";

    info.append(name, preview);
    li.append(av, info);
    li.addEventListener("click", () => openChat(c));
    list.appendChild(li);
  }
}

/* ================= OPEN CHAT ================= */
async function openChat(contact) {
  active = contact;

  $("welcome").classList.add("hidden");
  $("chat-view").classList.remove("hidden");
  $("chat-avatar").textContent = contact.username[0].toUpperCase();
  $("chat-name").textContent   = contact.username;

  $("messages").innerHTML = "";
  renderedIds.clear();

  appEl.classList.add("chat-open");
  renderContacts($("search").value);

  await loadMessages();
  $("message-input").focus();
}

async function loadMessages() {
  if (!active) return;

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, content, created_at")
    .or(
      `and(sender_id.eq.${me.id},receiver_id.eq.${active.id}),` +
      `and(sender_id.eq.${active.id},receiver_id.eq.${me.id})`
    )
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("loadMessages:", error);
    return;
  }

  for (const m of data || []) appendMessage(m);

  const last = data?.[data.length - 1];
  if (last) previews[active.id] = last.content;

  renderContacts($("search").value);
  scrollToBottom();
}

/* ================= RENDER MESSAGE ================= */
function appendMessage(m) {
  if (renderedIds.has(m.id)) return;
  renderedIds.add(m.id);

  const row = document.createElement("div");
  row.className = "bubble-row " + (m.sender_id === me.id ? "out" : "in");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const text = document.createElement("p");
  text.textContent = m.content;

  const time = document.createElement("span");
  time.className = "time";
  time.textContent = formatTime(m.created_at);

  bubble.append(text, time);
  row.appendChild(bubble);
  $("messages").appendChild(row);

  const otherId = m.sender_id === me.id ? m.receiver_id : m.sender_id;
  previews[otherId] = m.content;
}

function scrollToBottom() {
  const box = $("messages");
  box.scrollTop = box.scrollHeight;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/* ================= SEND ================= */
$("composer").addEventListener("submit", async (e) => {
  e.preventDefault();

  const input   = $("message-input");
  const content = input.value.trim();
  if (!content || !active) return;

  input.value = "";

  const { data, error } = await supabase
    .from("messages")
    .insert({ sender_id: me.id, receiver_id: active.id, content })
    .select()
    .single();

  if (error) {
    console.error("send:", error);
    alert("Message failed to send: " + error.message);
    input.value = content;
    return;
  }

  appendMessage(data);
  previews[active.id] = content;
  renderContacts($("search").value);
  scrollToBottom();
});

/* ================= REALTIME ================= */
function subscribeRealtime() {
  supabase
    .channel("shadstech-messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        const m = payload.new;

        // RLS already filters, this is a belt-and-braces check
        if (m.sender_id !== me.id && m.receiver_id !== me.id) return;

        const otherId = m.sender_id === me.id ? m.receiver_id : m.sender_id;
        previews[otherId] = m.content;

        if (active && (m.sender_id === active.id || m.receiver_id === active.id)) {
          appendMessage(m);
          scrollToBottom();
        }
        renderContacts($("search").value);
      }
    )
    .subscribe();
}

/* ================= UI EVENTS ================= */
$("search").addEventListener("input", (e) => renderContacts(e.target.value));

$("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.replace("index.html");
});

$("back-btn").addEventListener("click", () => {
  active = null;
  $("chat-view").classList.add("hidden");
  $("welcome").classList.remove("hidden");
  appEl.classList.remove("chat-open");
  renderContacts($("search").value);
});

boot();