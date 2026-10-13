"use strict";

// =====================================================
// LEOMAIL — ОСНОВНОЙ SCRIPT (сервер + картинки + чат)
// =====================================================

const postsContainer = document.getElementById("posts");
const searchInput = document.getElementById("searchInput");
const homePage = document.getElementById("homePage");
const profilePage = document.getElementById("profilePage");
const postModal = document.getElementById("postModal");
const loginModal = document.getElementById("loginModal");
const profileModal = document.getElementById("profileModal");
const chatModal = document.getElementById("chatModal");
const newPostBtn = document.getElementById("newPostBtn");
const closeModal = document.getElementById("closeModal");
const loginBtn = document.getElementById("loginBtn");
const closeLogin = document.getElementById("closeLogin");
const doLogin = document.getElementById("doLogin");
const switchAuth = document.getElementById("switchAuth");
const authTitle = document.getElementById("authTitle");
const authInfo = document.getElementById("authInfo");
const publishBtn = document.getElementById("publishBtn");
const joinBtn = document.getElementById("joinBtn");
const memberCount = document.getElementById("memberCount");
const communityBtn = document.getElementById("communityBtn");
const homeMenu = document.getElementById("homeMenu");
const hotMenu = document.getElementById("hotMenu");
const newMenu = document.getElementById("newMenu");
const profileMenu = document.getElementById("profileMenu");
const homeLogo = document.getElementById("homeLogo");

const postImageInput = document.getElementById("postImage");
const imagePreviewBox = document.getElementById("imagePreviewBox");
const imagePreview = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImage");

const chatFab = document.getElementById("chatFab");
const closeChat = document.getElementById("closeChat");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");

// =====================================================
// ДАННЫЕ
// =====================================================

let posts = [];
let communities = [];
let currentSort = "hot";
let currentSearch = "";
let currentCommunity = null;
let userVotes = {};
let joinedCommunities = [];
let isRegisterMode = false;

let postsLoaded = false;
let loadError = false;
let lastSignature = "";

let pendingImage = null;
let chatLastId = 0;
let chatLoaded = false;

const openComments = new Set();
const commentDrafts = {};

const POLL_INTERVAL = 4000;
const COMMUNITY_POLL_INTERVAL = 15000;
const CHAT_POLL_INTERVAL = 3000;

// =====================================================
// ЗАПРОСЫ К СЕРВЕРУ
// =====================================================

async function api(path, options = {}) {
    try {
        const headers = {};

        if (options.body) {
            headers["Content-Type"] = "application/json";
        }

        const token = localStorage.getItem("leomail_token");
        if (token) {
            headers["Authorization"] = "Bearer " + token;
        }

        const response = await fetch(path, {
            method: options.method || "GET",
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            cache: "no-store"
        });

        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }

        return {
            ok: response.ok && data.success !== false,
            status: response.status,
            data: data
        };
    } catch (error) {
        console.error("Ошибка сети:", error);
        return {
            ok: false,
            network: true,
            status: 0,
            data: { message: "Не удалось подключиться к серверу." }
        };
    }
}

// =====================================================
// ПОЛЬЗОВАТЕЛЬ И ЛОКАЛЬНЫЕ НАСТРОЙКИ
// =====================================================

function getCurrentUser() {
    return localStorage.getItem("leomail_user") || null;
}

function getCurrentUsername() {
    return getCurrentUser() || "Guest";
}

function isMine(name) {
    const user = getCurrentUser();
    return !!user && String(name).toLowerCase() === user.toLowerCase();
}

function clearAuth() {
    localStorage.removeItem("leomail_user");
    localStorage.removeItem("leomail_token");
    localStorage.removeItem("leomail_profile");
}

function requireLogin() {
    const user = getCurrentUser();
    const token = localStorage.getItem("leomail_token");

    if (!user || !token) {
        if (user) {
            clearAuth();
            updateLoginButton();
            loadUserVotes();
            renderPosts();
        }

        alert("Войдите в аккаунт, чтобы продолжить.");
        openLogin();
        return null;
    }

    return user;
}

function sessionExpired() {
    clearAuth();
    updateLoginButton();
    loadUserVotes();
    renderPosts();
    alert("Сессия устарела. Войдите в аккаунт заново.");
    openLogin();
}

function votesKey() {
    return "leomail_votes_" + getCurrentUsername().toLowerCase();
}

function loadUserVotes() {
    try {
        const saved = localStorage.getItem(votesKey());
        userVotes = saved ? JSON.parse(saved) : {};
    } catch (e) {
        userVotes = {};
    }
}

function saveVotes() {
    localStorage.setItem(votesKey(), JSON.stringify(userVotes));
}

function loadJoined() {
    try {
        const saved = localStorage.getItem("leomail_joined");
        joinedCommunities = saved ? JSON.parse(saved) : [];
    } catch (e) {
        joinedCommunities = [];
    }
}

function saveJoined() {
    localStorage.setItem(
        "leomail_joined",
        JSON.stringify(joinedCommunities)
    );
}

function getProfile() {
    try {
        const saved = localStorage.getItem("leomail_profile");
        if (saved) {
            const profile = JSON.parse(saved);
            profile.name = getCurrentUsername();
            return profile;
        }
    } catch (e) {
        console.error("Ошибка профиля:", e);
    }

    return {
        name: getCurrentUsername(),
        bio: "Новый пользователь Leomail 🦁",
        avatar: "🦁"
    };
}

function saveProfile(profile) {
    localStorage.setItem("leomail_profile", JSON.stringify(profile));
}

async function syncProfileFromServer() {
    const user = getCurrentUser();
    if (!user) return;

    const res = await api("/api/users/" + encodeURIComponent(user));
    if (!res.ok || !res.data.user) return;

    saveProfile({
        name: res.data.user.username,
        bio: res.data.user.bio,
        avatar: res.data.user.avatar
    });

    if (profilePage.classList.contains("show")) {
        renderProfile();
    }
}

// =====================================================
// БЕЗОПАСНОСТЬ HTML
// =====================================================

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =====================================================
// ВРЕМЯ
// =====================================================

function getTimeText(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return "только что";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + " мин. назад";

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " ч. назад";

    const days = Math.floor(hours / 24);
    return days + " дн. назад";
}

function getClockText(timestamp) {
    const date = new Date(timestamp);
    return (
        String(date.getHours()).padStart(2, "0") +
        ":" +
        String(date.getMinutes()).padStart(2, "0")
    );
}

// =====================================================
// СТРАНИЦЫ
// =====================================================

function showHome() {
    if (homePage) homePage.style.display = "block";
    if (profilePage) profilePage.classList.remove("show");
    renderPosts();
}

function showProfile() {
    if (homePage) homePage.style.display = "none";
    if (profilePage) profilePage.classList.add("show");
    renderProfile();
}

// =====================================================
// ЗАГРУЗКА ПОСТОВ С СЕРВЕРА
// =====================================================

async function loadPosts() {
    const res = await api("/api/posts");

    if (!res.ok) {
        if (!postsLoaded) {
            loadError = true;
            renderPosts();
        }
        return;
    }

    const fresh = (res.data.posts || []).map(post => ({
        id: String(post.id),
        title: post.title,
        text: post.text,
        author: post.author,
        community: post.community,
        hasImage: !!post.hasImage,
        votes: Number(post.votes) || 0,
        createdAt: Number(post.createdAt) || Date.now(),
        comments: (post.comments || []).map(comment => ({
            id: comment.id,
            author: comment.author,
            text: comment.text,
            createdAt: Number(comment.createdAt) || Date.now()
        }))
    }));

    const signature = JSON.stringify(fresh);

    if (postsLoaded && signature === lastSignature) {
        return;
    }

    lastSignature = signature;
    posts = fresh;
    postsLoaded = true;
    loadError = false;

    renderPosts();

    if (profilePage.classList.contains("show")) {
        renderProfile();
    }
}

async function loadCommunities() {
    const res = await api("/api/communities");
    if (!res.ok) return;

    communities = (res.data.communities || []).map(item => ({
        name: item.name,
        description: item.description,
        members: Number(item.members) || 0,
        joined: joinedCommunities.includes(item.name)
    }));

    restoreCustomCommunities();
    updateCommunityCard();
}

// =====================================================
// ПОСТЫ: ФИЛЬТР И СОРТИРОВКА
// =====================================================

function getVisiblePosts() {
    let result = [...posts];

    if (currentCommunity) {
        result = result.filter(
            post => post.community === currentCommunity
        );
    }

    if (currentSearch) {
        const query = currentSearch.toLowerCase();

        result = result.filter(post =>
            post.title.toLowerCase().includes(query) ||
            post.text.toLowerCase().includes(query) ||
            post.author.toLowerCase().includes(query) ||
            post.community.toLowerCase().includes(query)
        );
    }

    if (currentSort === "new") {
        result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (currentSort === "top") {
        result.sort((a, b) => b.votes - a.votes);
    } else {
        result.sort((a, b) => {
            const ageA = Math.max(1, (Date.now() - a.createdAt) / 3600000);
            const ageB = Math.max(1, (Date.now() - b.createdAt) / 3600000);
            const scoreA = a.votes / Math.pow(ageA + 2, 0.6);
            const scoreB = b.votes / Math.pow(ageB + 2, 0.6);
            return scoreB - scoreA;
        });
    }

    return result;
}

// =====================================================
// ОТОБРАЖЕНИЕ ПОСТОВ
// =====================================================

function renderPosts() {
    if (!postsContainer) return;

    const scrollY = window.scrollY;
    const active = document.activeElement;
    let focusId = null;
    let selStart = 0;
    let selEnd = 0;

    if (
        active &&
        active.classList &&
        active.classList.contains("comment-input")
    ) {
        focusId = active.dataset.id;
        selStart = active.selectionStart;
        selEnd = active.selectionEnd;
    }

    if (!postsLoaded) {
        postsContainer.innerHTML = `
            <div class="post">
                <div class="post-body">
                    <h2 class="post-title">
                        ${loadError ? "Не удалось загрузить посты" : "Загрузка..."}
                    </h2>
                    <div class="post-text">
                        ${loadError
                            ? "Сервер, возможно, просыпается. Подождите немного — сайт попробует снова."
                            : "Подождите секунду."}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const visiblePosts = getVisiblePosts();
    postsContainer.innerHTML = "";

    if (visiblePosts.length === 0) {
        postsContainer.innerHTML = `
            <div class="post">
                <div class="post-body">
                    <h2 class="post-title">Здесь пока пусто</h2>
                    <div class="post-text">Создайте первый пост!</div>
                </div>
            </div>
        `;
        return;
    }

    visiblePosts.forEach(post => {
        const article = document.createElement("article");
        article.className = "post";

        const vote = userVotes[post.id] || 0;
        const id = escapeHTML(post.id);
        const draft = commentDrafts[post.id] || "";

        const imageHTML = post.hasImage
            ? `<img class="post-image" loading="lazy" alt=""
                   src="/api/posts/${encodeURIComponent(post.id)}/image">`
            : "";

        const deleteHTML = isMine(post.author)
            ? `<button class="post-action delete-post" data-id="${id}">
                   🗑 Удалить
               </button>`
            : "";

        article.innerHTML = `
            <div class="vote">
                <button class="upvote ${vote === 1 ? "voted" : ""}"
                    data-id="${id}">▲</button>

                <div class="vote-count">${post.votes}</div>

                <button class="downvote ${vote === -1 ? "voted" : ""}"
                    data-id="${id}">▼</button>
            </div>

            <div class="post-body">
                <div class="post-meta">
                    🟠
                    <button class="community-link"
                        data-community="${escapeHTML(post.community)}">
                        r/${escapeHTML(post.community)}
                    </button>
                    ·
                    <button class="author-link">
                        u/${escapeHTML(post.author)}
                    </button>
                    ·
                    ${getTimeText(post.createdAt)}
                </div>

                <h2 class="post-title">${escapeHTML(post.title)}</h2>

                <div class="post-text">${escapeHTML(post.text)}</div>

                ${imageHTML}

                <div class="post-actions">
                    <button class="post-action comment-btn" data-id="${id}">
                        💬 ${post.comments.length} комментариев
                    </button>

                    <button class="post-action share-btn" data-id="${id}">
                        ↗ Поделиться
                    </button>

                    ${deleteHTML}
                </div>

                <div class="comments ${openComments.has(post.id) ? "open" : ""}"
                    id="comments-${id}">

                    ${renderComments(post)}

                    <div class="comment-form">
                        <input class="comment-input"
                            data-id="${id}"
                            maxlength="500"
                            value="${escapeHTML(draft)}"
                            placeholder="Написать комментарий...">

                        <button class="comment-submit" data-id="${id}">
                            Отправить
                        </button>
                    </div>
                </div>
            </div>
        `;

        postsContainer.appendChild(article);
    });

    attachPostEvents();

    if (focusId) {
        const input = document.querySelector(
            `.comment-input[data-id="${focusId}"]`
        );
        if (input) {
            input.focus();
            try {
                input.setSelectionRange(selStart, selEnd);
            } catch (e) {}
        }
    }

    window.scrollTo(0, scrollY);
}

// =====================================================
// КОММЕНТАРИИ
// =====================================================

function renderComments(post) {
    if (!post.comments || post.comments.length === 0) {
        return `<p style="color:#888">Пока нет комментариев.</p>`;
    }

    return post.comments
        .map(comment => {
            const canDelete =
                isMine(comment.author) || isMine(post.author);

            const deleteHTML = canDelete
                ? `<button class="comment-delete"
                        data-post="${escapeHTML(post.id)}"
                        data-id="${escapeHTML(comment.id)}"
                        title="Удалить комментарий">🗑</button>`
                : "";

            return `
                <div class="comment">
                    <div class="comment-user">
                        u/${escapeHTML(comment.author)}
                        <span style="color:#888;font-weight:normal">
                            · ${getTimeText(comment.createdAt)}
                        </span>
                        ${deleteHTML}
                    </div>
                    <div class="comment-text">${escapeHTML(comment.text)}</div>
                </div>
            `;
        })
        .join("");
}

async function addComment(id) {
    const user = requireLogin();
    if (!user) return;

    const input = document.querySelector(
        `.comment-input[data-id="${id}"]`
    );
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const submit = document.querySelector(
        `.comment-submit[data-id="${id}"]`
    );
    if (submit) submit.disabled = true;

    const res = await api(
        "/api/posts/" + encodeURIComponent(id) + "/comments",
        {
            method: "POST",
            body: { text: text }
        }
    );

    if (res.status === 401) {
        sessionExpired();
        return;
    }

    if (!res.ok) {
        alert(res.data.message || "Не удалось отправить комментарий.");
        if (submit) submit.disabled = false;
        return;
    }

    const post = posts.find(item => item.id === id);

    if (post) {
        post.comments.push({
            id: res.data.comment.id,
            author: res.data.comment.author,
            text: res.data.comment.text,
            createdAt: Number(res.data.comment.createdAt) || Date.now()
        });
    }

    delete commentDrafts[id];
    openComments.add(id);
    lastSignature = JSON.stringify(posts);
    renderPosts();

    loadPosts();
}

async function deleteComment(postId, commentId) {
    if (!requireLogin()) return;
    if (!confirm("Удалить этот комментарий?")) return;

    const res = await api(
        "/api/posts/" + encodeURIComponent(postId) +
        "/comments/" + encodeURIComponent(commentId),
        { method: "DELETE" }
    );

    if (res.status === 401) {
        sessionExpired();
        return;
    }

    if (!res.ok) {
        alert(res.data.message || "Не удалось удалить комментарий.");
        return;
    }

    const post = posts.find(item => item.id === postId);

    if (post) {
        post.comments = post.comments.filter(
            comment => comment.id !== commentId
        );
    }

    lastSignature = JSON.stringify(posts);
    renderPosts();
    loadPosts();
}

// =====================================================
// УДАЛЕНИЕ ПОСТА
// =====================================================

async function deletePost(id) {
    if (!requireLogin()) return;
    if (!confirm("Удалить этот пост?")) return;

    const res = await api(
        "/api/posts/" + encodeURIComponent(id),
        { method: "DELETE" }
    );

    if (res.status === 401) {
        sessionExpired();
        return;
    }

    if (!res.ok) {
        alert(res.data.message || "Не удалось удалить пост.");
        return;
    }

    posts = posts.filter(post => post.id !== id);
    lastSignature = JSON.stringify(posts);
    renderPosts();

    if (profilePage.classList.contains("show")) {
        renderProfile();
    }

    loadPosts();
}

// =====================================================
// ГОЛОСОВАНИЕ
// =====================================================

async function votePost(postId, newVote) {
    const user = requireLogin();
    if (!user) return;

    const post = posts.find(item => item.id === postId);
    if (!post) return;

    const current = userVotes[postId] || 0;
    const value = current === newVote ? 0 : newVote;

    post.votes += value - current;

    if (value === 0) {
        delete userVotes[postId];
    } else {
        userVotes[postId] = value;
    }

    saveVotes();
    renderPosts();

    const res = await api(
        "/api/posts/" + encodeURIComponent(postId) + "/vote",
        {
            method: "POST",
            body: { username: user, value: value }
        }
    );

    if (res.ok) {
        post.votes = Number(res.data.votes) || 0;
        lastSignature = JSON.stringify(posts);
        renderPosts();
    } else {
        post.votes -= value - current;

        if (current === 0) {
            delete userVotes[postId];
        } else {
            userVotes[postId] = current;
        }

        saveVotes();
        renderPosts();
        alert(res.data.message || "Не удалось проголосовать.");
    }
}

// =====================================================
// СОБЫТИЯ ПОСТОВ
// =====================================================

function attachPostEvents() {
    document.querySelectorAll(".upvote").forEach(button => {
        button.addEventListener("click", () => {
            votePost(button.dataset.id, 1);
        });
    });

    document.querySelectorAll(".downvote").forEach(button => {
        button.addEventListener("click", () => {
            votePost(button.dataset.id, -1);
        });
    });

    document.querySelectorAll(".delete-post").forEach(button => {
        button.addEventListener("click", () => {
            deletePost(button.dataset.id);
        });
    });

    document.querySelectorAll(".comment-delete").forEach(button => {
        button.addEventListener("click", () => {
            deleteComment(button.dataset.post,
