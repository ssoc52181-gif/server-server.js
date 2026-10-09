"use strict";

// =====================================================
// LEOMAIL — ОСНОВНОЙ SCRIPT (работает через сервер)
// =====================================================

const postsContainer = document.getElementById("posts");
const searchInput = document.getElementById("searchInput");
const homePage = document.getElementById("homePage");
const profilePage = document.getElementById("profilePage");
const postModal = document.getElementById("postModal");
const loginModal = document.getElementById("loginModal");
const profileModal = document.getElementById("profileModal");
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

const openComments = new Set();
const commentDrafts = {};

const POLL_INTERVAL = 4000;
const COMMUNITY_POLL_INTERVAL = 15000;

// =====================================================
// ЗАПРОСЫ К СЕРВЕРУ
// =====================================================

async function api(path, options = {}) {
    try {
        const response = await fetch(path, {
            method: options.method || "GET",
            headers: options.body
                ? { "Content-Type": "application/json" }
                : undefined,
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
            data: data
        };
    } catch (error) {
        console.error("Ошибка сети:", error);
        return {
            ok: false,
            network: true,
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

function requireLogin() {
    const user = getCurrentUser();

    if (!user) {
        alert("Сначала войдите в аккаунт или зарегистрируйтесь.");
        openLogin();
        return null;
    }

    return user;
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

    // Запоминаем, где был пользователь, чтобы обновление не мешало
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

                <div class="post-actions">
                    <button class="post-action comment-btn" data-id="${id}">
                        💬 ${post.comments.length} комментариев
                    </button>

                    <button class="post-action share-btn" data-id="${id}">
                        ↗ Поделиться
                    </button>
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

    // Возвращаем фокус и прокрутку
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
        .map(comment => `
            <div class="comment">
                <div class="comment-user">
                    u/${escapeHTML(comment.author)}
                    <span style="color:#888;font-weight:normal">
                        · ${getTimeText(comment.createdAt)}
                    </span>
                </div>
                <div class="comment-text">${escapeHTML(comment.text)}</div>
            </div>
        `)
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
            body: { author: user, text: text }
        }
    );

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

    // Сразу подтягиваем свежие данные с сервера
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

    // Сразу показываем результат
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
        // Откатываем
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

        if (!text) {
            alert("Напишите текст поста.");
            return;
        }

        publishBtn.disabled = true;
        publishBtn.textContent = "Публикация...";

        const res = await api("/api/posts", {
            method: "POST",
            body: {
                title: title,
                text: text,
                author: user,
                community: currentCommunity || "Leomail"
            }
        });

        publishBtn.disabled = false;
        publishBtn.textContent = "Опубликовать";

        if (!res.ok) {
            alert(res.data.message || "Не удалось опубликовать пост.");
            return;
        }

        titleInput.value = "";
        textInput.value = "";
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
// АВТОРИЗАЦИЯ
// =====================================================

function openLogin() {
    if (!loginModal) return;

    isRegisterMode = false;
    updateAuthMode();
    loginModal.classList.add("show");
}

function logout() {
    localStorage.removeItem("leomail_user");
    localStorage.removeItem("leomail_profile");

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

        // Регистрация не возвращает вход автоматически — входим сразу
        let finalUsername = res.data.user.username;

        localStorage.setItem("leomail_user", finalUsername);
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

// Автообновление: новые посты и комментарии друзей
setInterval(loadPosts, POLL_INTERVAL);
setInterval(loadCommunities, COMMUNITY_POLL_INTERVAL);

// Обновить сразу, когда возвращаешься на вкладку или в приложение
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        loadPosts();
        loadCommunities();
    }
});

window.addEventListener("focus", loadPosts);

console.log("Leomail frontend запущен 🦁");
