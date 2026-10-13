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
                        deleteComment(button.dataset.post, button.dataset.id);
        });
    });

    document.querySelectorAll(".comment-btn").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.id;
            const box = document.getElementById("comments-" + id);

            if (box) {
                box.classList.toggle("open");

                if (box.classList.contains("open")) {
                    openComments.add(id);
                } else {
                    openComments.delete(id);
                }
            }
        });
    });

    document.querySelectorAll(".comment-submit").forEach(button => {
        button.addEventListener("click", () => {
            addComment(button.dataset.id);
        });
    });

    document.querySelectorAll(".comment-input").forEach(input => {
        input.addEventListener("input", () => {
            commentDrafts[input.dataset.id] = input.value;
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                addComment(input.dataset.id);
            }
        });
    });

    document.querySelectorAll(".community-link").forEach(button => {
        button.addEventListener("click", () => {
            openCommunity(button.dataset.community);
        });
    });

    document.querySelectorAll(".author-link").forEach(button => {
        button.addEventListener("click", showProfile);
    });

    document.querySelectorAll(".share-btn").forEach(button => {
        button.addEventListener("click", async () => {
            const post = posts.find(item => item.id === button.dataset.id);
            if (!post) return;

            const text = post.title + "\n\n" + post.text;

            try {
                await navigator.clipboard.writeText(text);
                button.textContent = "✓ Скопировано";

                setTimeout(() => {
                    button.textContent = "↗ Поделиться";
                }, 1500);
            } catch (e) {
                alert("Не удалось скопировать текст.");
            }
        });
    });
}

// =====================================================
// КАРТИНКИ В ПОСТАХ
// =====================================================

function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => reject(new Error("read"));

        reader.onload = () => {
            const img = new Image();

            img.onerror = () => reject(new Error("image"));

            img.onload = () => {
                const maxSize = 900;
                let width = img.width;
                let height = img.height;

                if (Math.max(width, height) > maxSize) {
                    const scale = maxSize / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext("2d");
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };

            img.src = reader.result;
        };

        reader.readAsDataURL(file);
    });
}

function clearPendingImage() {
    pendingImage = null;

    if (postImageInput) postImageInput.value = "";
    if (imagePreviewBox) imagePreviewBox.hidden = true;
    if (imagePreview) imagePreview.removeAttribute("src");
}

if (postImageInput) {
    postImageInput.addEventListener("change", async () => {
        const file = postImageInput.files && postImageInput.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Выберите файл-картинку.");
            clearPendingImage();
            return;
        }

        try {
            pendingImage = await resizeImage(file);
            imagePreview.src = pendingImage;
            imagePreviewBox.hidden = false;
        } catch (e) {
            alert("Не удалось открыть эту картинку.");
            clearPendingImage();
        }
    });
}

if (removeImageBtn) {
    removeImageBtn.addEventListener("click", clearPendingImage);
}

// =====================================================
// СОЗДАНИЕ ПОСТА
// =====================================================

if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
        if (!requireLogin()) return;

        postModal.classList.add("show");
        updatePostCommunity();
    });
}

if (closeModal) {
    closeModal.addEventListener("click", () => {
        postModal.classList.remove("show");
    });
}

function updatePostCommunity() {
    const communityText = document.querySelector(".modal-bottom span");
    if (!communityText) return;

    communityText.textContent = "🟠 r/" + (currentCommunity || "Leomail");
}

if (publishBtn) {
    publishBtn.addEventListener("click", async () => {
        const user = requireLogin();
        if (!user) return;

        const titleInput = document.getElementById("postTitle");
        const textInput = document.getElementById("postText");

        const title = titleInput.value.trim();
        const text = textInput.value.trim();

        if (!title) {
            alert("Введите заголовок.");
            return;
        }

        if (!text && !pendingImage) {
            alert("Напишите текст поста или добавьте картинку.");
            return;
        }

        publishBtn.disabled = true;
        publishBtn.textContent = "Публикация...";

        const res = await api("/api/posts", {
            method: "POST",
            body: {
                title: title,
                text: text,
                image: pendingImage || undefined,
                community: currentCommunity || "Leomail"
            }
        });

        publishBtn.disabled = false;
        publishBtn.textContent = "Опубликовать";

        if (res.status === 401) {
            sessionExpired();
            return;
        }

        if (!res.ok) {
            alert(res.data.message || "Не удалось опубликовать пост.");
            return;
        }

        titleInput.value = "";
        textInput.value = "";
        clearPendingImage();
        postModal.classList.remove("show");

        currentSort = "new";
        updateSortButtons();

        await loadPosts();
    });
}

// =====================================================
// ПОИСК
// =====================================================

if (searchInput) {
    searchInput.addEventListener("input", () => {
        currentSearch = searchInput.value.trim();
        renderPosts();
    });
}

// =====================================================
// СОРТИРОВКА
// =====================================================

document.querySelectorAll(".sort").forEach(button => {
    button.addEventListener("click", () => {
        currentSort = button.dataset.sort;
        updateSortButtons();
        renderPosts();
    });
});

function updateSortButtons() {
    document.querySelectorAll(".sort").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.sort === currentSort
        );
    });
}

// =====================================================
// МЕНЮ
// =====================================================

if (homeMenu) {
    homeMenu.addEventListener("click", () => {
        currentCommunity = null;
        currentSearch = "";

        if (searchInput) searchInput.value = "";

        updateCommunityCard();
        showHome();
    });
}

if (hotMenu) {
    hotMenu.addEventListener("click", () => {
        currentCommunity = null;
        currentSort = "hot";
        updateSortButtons();
        updateCommunityCard();
        showHome();
    });
}

if (newMenu) {
    newMenu.addEventListener("click", () => {
        currentCommunity = null;
        currentSort = "new";
        updateSortButtons();
        updateCommunityCard();
        showHome();
    });
}

if (profileMenu) {
    profileMenu.addEventListener("click", showProfile);
}

if (homeLogo) {
    homeLogo.addEventListener("click", event => {
        event.preventDefault();
        currentCommunity = null;
        updateCommunityCard();
        showHome();
    });
}

// =====================================================
// СООБЩЕСТВА
// =====================================================

function openCommunity(name) {
    const community = communities.find(
        item => item.name.toLowerCase() === String(name).toLowerCase()
    );

    currentCommunity = community ? community.name : name;

    updateCommunityCard();
    updatePostCommunity();
    showHome();
}

function updateCommunityCard() {
    const name = currentCommunity || "Leomail";
    const community = communities.find(item => item.name === name);

    if (!community) return;

    const title = document.querySelector(".community-content h2");
    const description = document.querySelector(".community-content p");

    if (title) title.textContent = "r/" + community.name;
    if (description) description.textContent = community.description;

    if (memberCount) {
        memberCount.textContent = community.members.toLocaleString("ru-RU");
    }

    if (joinBtn) {
        joinBtn.textContent = community.joined
            ? "✓ Вы участник"
            : "Присоединиться";

        joinBtn.classList.toggle("joined", community.joined);
    }
}

if (joinBtn) {
    joinBtn.addEventListener("click", async () => {
        const user = requireLogin();
        if (!user) return;

        const name = currentCommunity || "Leomail";
        const community = communities.find(item => item.name === name);

        if (!community) return;

        const willJoin = !community.joined;

        const res = await api(
            "/api/communities/" + encodeURIComponent(name) + "/join",
            {
                method: "POST",
                body: { username: user, joined: willJoin }
            }
        );

        if (!res.ok) {
            alert(res.data.message || "Не удалось выполнить действие.");
            return;
        }

        community.joined = willJoin;
        community.members = Number(res.data.members) || 0;

        if (willJoin) {
            if (!joinedCommunities.includes(name)) {
                joinedCommunities.push(name);
            }
        } else {
            joinedCommunities = joinedCommunities.filter(
                item => item !== name
            );
        }

        saveJoined();
        updateCommunityCard();
    });
}

// =====================================================
// СОЗДАНИЕ СООБЩЕСТВА
// =====================================================

if (communityBtn) {
    communityBtn.addEventListener("click", async () => {
        const user = requireLogin();
        if (!user) return;

        const name = prompt("Введите название сообщества:");
        if (!name) return;

        const cleanName = name
            .trim()
            .replace(/^r\//i, "")
            .replace(/\s+/g, "");

        if (cleanName.length < 3) {
            alert("Название должно содержать минимум 3 символа.");
            return;
        }

        const description =
            prompt("Введите описание сообщества:") ||
            "Новое сообщество Leomail.";

        const res = await api("/api/communities", {
            method: "POST",
            body: {
                name: cleanName,
                description: description,
                author: user
            }
        });

        if (!res.ok) {
            alert(res.data.message || "Не удалось создать сообщество.");
            return;
        }

        const created = {
            name: res.data.community.name,
            description: res.data.community.description,
            members: 1,
            joined: true
        };

        communities.push(created);
        joinedCommunities.push(created.name);
        saveJoined();

        addCommunityToSidebar(created);
        openCommunity(created.name);

        alert("Сообщество r/" + created.name + " создано!");
    });
}

function addCommunityToSidebar(community) {
    const sidebar = document.querySelector(".sidebar");
    const createButton = document.getElementById("communityBtn");

    if (!sidebar || !createButton) return;

    const button = document.createElement("button");

    button.className = "side-item";
    button.dataset.community = community.name;
    button.textContent = "🟠 r/" + community.name;

    button.addEventListener("click", () => {
        openCommunity(community.name);
    });

    sidebar.insertBefore(button, createButton);
}

function restoreCustomCommunities() {
    const existing = new Set(
        [...document.querySelectorAll(".sidebar [data-community]")].map(
            button => button.dataset.community
        )
    );

    communities.forEach(community => {
        if (!existing.has(community.name)) {
            addCommunityToSidebar(community);
            existing.add(community.name);
        }
    });
}

// =====================================================
// ПРОФИЛЬ
// =====================================================

function renderProfile() {
    const profile = getProfile();

    const profileAvatar = document.getElementById("profileAvatar");
    const profileName = document.getElementById("profileName");
    const profileUsername = document.getElementById("profileUsername");
    const profileBio = document.getElementById("profileBio");

    if (profileAvatar) profileAvatar.textContent = profile.avatar;
    if (profileName) profileName.textContent = profile.name;
    if (profileUsername) profileUsername.textContent = "u/" + profile.name;
    if (profileBio) profileBio.textContent = profile.bio;

    const nameLower = profile.name.toLowerCase();

    const userPosts = posts.filter(
        post => post.author.toLowerCase() === nameLower
    );

    const karma = userPosts.reduce((sum, post) => sum + post.votes, 0);

    let commentsCount = 0;
    posts.forEach(post => {
        post.comments.forEach(comment => {
            if (comment.author.toLowerCase() === nameLower) {
                commentsCount++;
            }
        });
    });

    const profileKarma = document.getElementById("profileKarma");
    const profilePosts = document.getElementById("profilePosts");
    const profileComments = document.getElementById("profileComments");

    if (profileKarma) profileKarma.textContent = karma;
    if (profilePosts) profilePosts.textContent = userPosts.length;
    if (profileComments) profileComments.textContent = commentsCount;

    const list = document.getElementById("profilePostsList");
    if (!list) return;

    if (userPosts.length === 0) {
        list.innerHTML = `
            <div class="no-profile-posts">
                У пользователя пока нет постов.
            </div>
        `;
        return;
    }

    list.innerHTML = userPosts
        .map(post => `
            <div class="profile-post">
                <div class="post-meta">
                    🟠 r/${escapeHTML(post.community)}
                </div>
                <h3>${escapeHTML(post.title)}</h3>
                <p>${escapeHTML(post.text)}</p>
            </div>
        `)
        .join("");
}

// =====================================================
// РЕДАКТИРОВАНИЕ ПРОФИЛЯ
// =====================================================

const editProfileBtn = document.getElementById("editProfileBtn");
const closeProfileModal = document.getElementById("closeProfileModal");
const saveProfileBtn = document.getElementById("saveProfileBtn");

let selectedAvatar = "🦁";

if (editProfileBtn) {
    editProfileBtn.addEventListener("click", () => {
        if (!requireLogin()) return;

        const profile = getProfile();
        const nameField = document.getElementById("editName");

        nameField.value = profile.name;
        nameField.readOnly = true;

        document.getElementById("editBio").value = profile.bio;

        selectedAvatar = profile.avatar;

        document
            .querySelectorAll("#avatarPicker button")
            .forEach(button => {
                button.classList.toggle(
                    "selected",
                    button.dataset.avatar === profile.avatar
                );
            });

        profileModal.classList.add("show");
    });
}

if (closeProfileModal) {
    closeProfileModal.addEventListener("click", () => {
        profileModal.classList.remove("show");
    });
}

document.querySelectorAll("#avatarPicker button").forEach(button => {
    button.addEventListener("click", () => {
        selectedAvatar = button.dataset.avatar;

        document
            .querySelectorAll("#avatarPicker button")
            .forEach(item => item.classList.remove("selected"));

        button.classList.add("selected");
    });
});

if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
        const user = requireLogin();
        if (!user) return;

        const bio =
            document.getElementById("editBio").value.trim() ||
            "Новый пользователь Leomail 🦁";

        saveProfileBtn.disabled = true;

        const res = await api("/api/users/" + encodeURIComponent(user), {
            method: "PUT",
            body: { bio: bio, avatar: selectedAvatar }
        });

        saveProfileBtn.disabled = false;

        if (res.status === 401) {
            sessionExpired();
            return;
        }

        if (!res.ok) {
            alert(res.data.message || "Не удалось сохранить профиль.");
            return;
        }

        saveProfile({
            name: user,
            bio: res.data.user.bio,
            avatar: res.data.user.avatar
        });

        profileModal.classList.remove("show");
        renderProfile();
    });
}

// =====================================================
// ОБЩИЙ ЧАТ
// =====================================================

function chatIsNearBottom() {
    return (
        chatMessages.scrollHeight -
        chatMessages.scrollTop -
        chatMessages.clientHeight < 80
    );
}

function appendChatMessages(messages) {
    if (!messages.length) return;

    const stick = chatIsNearBottom() || !chatLoaded;

    const empty = chatMessages.querySelector(".chat-empty");
    if (empty) empty.remove();

    messages.forEach(message => {
        if (message.id <= chatLastId) return;

        const div = document.createElement("div");
        div.className = "chat-msg" + (isMine(message.author) ? " mine" : "");

        div.innerHTML = `
            <div class="chat-author">${escapeHTML(message.author)}</div>
            <div class="chat-text">${escapeHTML(message.text)}</div>
            <div class="chat-time">${getClockText(Number(message.createdAt))}</div>
        `;

        chatMessages.appendChild(div);
        chatLastId = message.id;
    });

    if (stick) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

async function loadChat() {
    const res = await api("/api/chat?after=" + chatLastId);
    if (!res.ok) return;

    const messages = res.data.messages || [];

    if (!chatLoaded && messages.length === 0) {
        chatMessages.innerHTML =
            '<div class="chat-empty">Пока здесь тихо. Напиши первым! 🦁</div>';
        chatLoaded = true;
        return;
    }

    appendChatMessages(messages);
    chatLoaded = true;
}

async function sendChat() {
    const user = requireLogin();
    if (!user) return;

    const text = chatInput.value.trim();
    if (!text) return;

    chatSend.disabled = true;

    const res = await api("/api/chat", {
        method: "POST",
        body: { text: text }
    });

    chatSend.disabled = false;

    if (res.status === 401) {
        sessionExpired();
        return;
    }

    if (!res.ok) {
        alert(res.data.message || "Не удалось отправить сообщение.");
        return;
    }

    chatInput.value = "";
    appendChatMessages([res.data.message]);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.focus();
}

if (chatFab) {
    chatFab.addEventListener("click", () => {
        chatModal.classList.add("show");
        loadChat();

        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 50);
    });
}

if (closeChat) {
    closeChat.addEventListener("click", () => {
        chatModal.classList.remove("show");
    });
}

if (chatSend) {
    chatSend.addEventListener("click", sendChat);
}

if (chatInput) {
    chatInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            sendChat();
        }
    });
}

// =====================================================
// АВТОРИЗАЦИЯ
// =====================================================

function openLogin() {
    if (!loginModal) return;

    isRegisterMode = false;
    updateAuthMode();
    loginModal.classList.add("show");
}

function logout() {
    clearAuth();

    loadUserVotes();
    updateLoginButton();
    renderProfile();
    renderPosts();
}

if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        if (getCurrentUser()) {
            if (confirm("Выйти из аккаунта " + getCurrentUser() + "?")) {
                logout();
            }
        } else {
            openLogin();
        }
    });
}

if (closeLogin) {
    closeLogin.addEventListener("click", () => {
        loginModal.classList.remove("show");
    });
}

if (switchAuth) {
    switchAuth.addEventListener("click", () => {
        isRegisterMode = !isRegisterMode;
        updateAuthMode();
    });
}

function updateAuthMode() {
    if (!authTitle) return;

    const password = document.getElementById("password");

    if (isRegisterMode) {
        authTitle.textContent = "Регистрация в Leomail";
        doLogin.textContent = "Зарегистрироваться";
        switchAuth.textContent = "Уже есть аккаунт? Войти";
        authInfo.textContent = "Создайте аккаунт Leomail.";

        if (password) {
            password.placeholder = "Пароль (минимум 6 символов)";
        }
    } else {
        authTitle.textContent = "Войти в Leomail";
        doLogin.textContent = "Войти";
        switchAuth.textContent = "Нет аккаунта? Зарегистрироваться";
        authInfo.textContent = "Войдите в свой аккаунт Leomail.";

        if (password) {
            password.placeholder = "Пароль";
        }
    }
}

if (doLogin) {
    doLogin.addEventListener("click", async () => {
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username) {
            alert("Введите имя пользователя.");
            return;
        }

        if (!password) {
            alert("Введите пароль.");
            return;
        }

        doLogin.disabled = true;
        doLogin.textContent = "Подождите...";

        const wasRegister = isRegisterMode;

        const res = await api(
            wasRegister ? "/api/register" : "/api/login",
            {
                method: "POST",
                body: { username: username, password: password }
            }
        );

        doLogin.disabled = false;
        updateAuthMode();

        if (!res.ok) {
            alert(res.data.message || "Произошла ошибка.");
            return;
        }

        localStorage.setItem("leomail_user", res.data.user.username);
        localStorage.setItem("leomail_token", res.data.token || "");
        localStorage.removeItem("leomail_profile");

        loginModal.classList.remove("show");
        usernameInput.value = "";
        passwordInput.value = "";

        loadUserVotes();
        updateLoginButton();
        renderPosts();
        renderProfile();
        syncProfileFromServer();

        alert(
            wasRegister
                ? "Регистрация успешна! 🦁"
                : "Вы вошли в Leomail! 🦁"
        );
    });
}

function updateLoginButton() {
    if (!loginBtn) return;

    const user = getCurrentUser();
    loginBtn.textContent = user ? "👤 " + user : "Войти";
}

// =====================================================
// ESC И ЗАКРЫТИЕ MODAL ПО ФОНУ
// =====================================================

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    document.querySelectorAll(".modal").forEach(modal => {
        modal.classList.remove("show");
    });
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            modal.classList.remove("show");
        }
    });
});

// =====================================================
// ЗАПУСК
// =====================================================

loadJoined();
loadUserVotes();
updateLoginButton();
updateSortButtons();
renderPosts();

loadCommunities();
loadPosts();
syncProfileFromServer();

setInterval(loadPosts, POLL_INTERVAL);
setInterval(loadCommunities, COMMUNITY_POLL_INTERVAL);

// Чат обновляется, только пока он открыт
setInterval(() => {
    if (
        chatModal &&
        chatModal.classList.contains("show") &&
        !document.hidden
    ) {
        loadChat();
    }
}, CHAT_POLL_INTERVAL);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        loadPosts();
        loadCommunities();
    }
});

window.addEventListener("focus", loadPosts);

console.log("Leomail frontend запущен 🦁");
