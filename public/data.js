"use strict";
// Data layer: Supabase (when configured and signed in) with a localStorage fallback.
const MirageData = (() => {
  const cfg = window.MIRAGE_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const sb = enabled
    ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  const LS = { settings: "mirage:settings", bookmarks: "mirage:bookmarks" };
  const DEFAULT_SETTINGS = { theme: "system", accent: "blue", filter: { type: "off", strength: 60 }, tab: { title: "", icon: "" } };

  const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const mergeSettings = (base, patch) => ({
    ...base, ...patch,
    filter: { ...base.filter, ...((patch && patch.filter) || {}) },
  });

  const state = {
    user: null,
    profile: null,
    settings: mergeSettings(DEFAULT_SETTINGS, readJSON(LS.settings, {})),
    bookmarks: readJSON(LS.bookmarks, []),
    history: [],
  };

  const listeners = {};
  const on = (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); };
  const emit = (name) => (listeners[name] || []).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  // ---------- session ----------
  async function init() {
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    await handleSession(data.session);
    sb.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      if (event === "SIGNED_IN" && session && state.user && session.user.id === state.user.id) return;
      // Do not call Supabase inside this callback directly.
      setTimeout(() => handleSession(session), 0);
    });
  }

  async function handleSession(session) {
    if (!session) {
      state.user = null; state.profile = null; state.history = [];
      state.bookmarks = readJSON(LS.bookmarks, []);
      emit("auth"); emit("bookmarks"); emit("history");
      return;
    }
    state.user = session.user;
    try {
      await loadProfile();
      await loadBookmarks();
    } catch (e) { console.error(e); }
    emit("auth"); emit("settings"); emit("bookmarks");
  }

  async function loadProfile() {
    const uid = state.user.id;
    let { data } = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (!data) {
      const name = (state.user.user_metadata && state.user.user_metadata.username) || (state.user.email || "user").split("@")[0];
      const ins = await sb.from("profiles").insert({ id: uid, username: name.slice(0, 20) }).select().maybeSingle();
      data = ins.data;
    }
    state.profile = data || { id: uid, username: "", avatar_url: null, settings: {} };
    const remote = (data && data.settings) || {};
    if (Object.keys(remote).length) {
      state.settings = mergeSettings(DEFAULT_SETTINGS, remote);
      writeJSON(LS.settings, state.settings);
    } else {
      scheduleRemoteSettings();
    }
  }

  // ---------- auth ----------
  async function signUp(email, password, username) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: location.origin } });
    if (error) throw error;
    return { needsConfirm: !data.session };
  }
  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async function signOut() { await sb.auth.signOut(); }

  // ---------- profile ----------
  async function updateUsername(name) {
    name = String(name || "").trim();
    if (name.length < 2 || name.length > 20) throw new Error("ユーザーネームは2〜20文字にしてください。");
    const { data, error } = await sb.from("profiles")
      .update({ username: name, updated_at: new Date().toISOString() })
      .eq("id", state.user.id).select().single();
    if (error) throw new Error(error.code === "23505" ? "そのユーザーネームは既に使われています。" : error.message);
    state.profile = data;
    emit("auth");
  }

  async function resizeToPng(file, size) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i); i.onerror = () => rej(new Error("画像を読み込めませんでした。"));
        i.src = url;
      });
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const side = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("画像を処理できませんでした。"))), "image/png"));
    } finally { URL.revokeObjectURL(url); }
  }

  async function uploadAvatar(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("画像ファイルを選んでください。");
    const blob = await resizeToPng(file, 256);
    const path = state.user.id + "/avatar.png";
    const up = await sb.storage.from("avatars").upload(path, blob, { upsert: true, contentType: "image/png" });
    if (up.error) throw up.error;
    const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl + "?v=" + Date.now();
    const { data, error } = await sb.from("profiles")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", state.user.id).select().single();
    if (error) throw error;
    state.profile = data;
    emit("auth");
  }

  // ---------- settings ----------
  let settingsTimer;
  function scheduleRemoteSettings() {
    if (!sb || !state.user) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(async () => {
      const { error } = await sb.from("profiles")
        .update({ settings: state.settings, updated_at: new Date().toISOString() })
        .eq("id", state.user.id);
      if (error) console.warn("settings sync failed", error);
    }, 600);
  }
  function setSettings(patch) {
    state.settings = mergeSettings(state.settings, patch);
    writeJSON(LS.settings, state.settings);
    emit("settings");
    scheduleRemoteSettings();
  }

  // ---------- bookmarks ----------
  async function loadBookmarks() {
    const local = readJSON(LS.bookmarks, []);
    if (local.length) {
      // Move bookmarks saved before signing in into the account.
      await sb.from("bookmarks").upsert(
        local.map((b) => ({ user_id: state.user.id, title: b.title, url: b.url })),
        { onConflict: "user_id,url", ignoreDuplicates: true }
      );
      writeJSON(LS.bookmarks, []);
    }
    const { data, error } = await sb.from("bookmarks").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    state.bookmarks = data || [];
  }
  const findBookmark = (url) => state.bookmarks.find((b) => b.url === url);
  const isBookmarked = (url) => !!findBookmark(url);

  async function addBookmark({ title, url }) {
    if (!url || isBookmarked(url)) return;
    title = title || url;
    if (sb && state.user) {
      const { data, error } = await sb.from("bookmarks").insert({ user_id: state.user.id, title, url }).select().single();
      if (error) throw error;
      state.bookmarks.unshift(data);
    } else {
      state.bookmarks.unshift({ id: "local-" + Date.now(), title, url, created_at: new Date().toISOString() });
      writeJSON(LS.bookmarks, state.bookmarks);
    }
    emit("bookmarks");
  }
  async function removeBookmark(id) {
    if (sb && state.user) {
      const { error } = await sb.from("bookmarks").delete().eq("id", id);
      if (error) throw error;
    }
    state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    if (!(sb && state.user)) writeJSON(LS.bookmarks, state.bookmarks);
    emit("bookmarks");
  }

  // ---------- history (account only) ----------
  async function loadHistory() {
    if (!sb || !state.user) return;
    const { data, error } = await sb.from("history").select("*").order("visited_at", { ascending: false }).limit(300);
    if (error) { console.warn(error); return; }
    state.history = data || [];
    emit("history");
  }
  async function addHistory({ title, url }) {
    if (!sb || !state.user || !url) return;
    const { data, error } = await sb.from("history").insert({ user_id: state.user.id, title: title || url, url }).select().single();
    if (error) { console.warn(error); return; }
    state.history.unshift(data);
    if (state.history.length > 300) state.history.length = 300;
    emit("history");
  }
  async function deleteHistory(id) {
    const { error } = await sb.from("history").delete().eq("id", id);
    if (error) throw error;
    state.history = state.history.filter((h) => h.id !== id);
    emit("history");
  }
  async function clearHistory() {
    const { error } = await sb.from("history").delete().eq("user_id", state.user.id);
    if (error) throw error;
    state.history = [];
    emit("history");
  }

  return {
    enabled, state, on, init,
    signUp, signIn, signOut, updateUsername, uploadAvatar,
    setSettings, addBookmark, removeBookmark, isBookmarked, findBookmark,
    loadHistory, addHistory, deleteHistory, clearHistory,
  };
})();
