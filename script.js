"use strict";

// =====================================================
// LEOMAIL — ОСНОВНОЙ SCRIPT
// =====================================================

const postsContainer =
    document.getElementById("posts");

const searchInput =
    document.getElementById("searchInput");

const homePage =
    document.getElementById("homePage");

const profilePage =
    document.getElementById("profilePage");

const postModal =
    document.getElementById("postModal");

const loginModal =
    document.getElementById("loginModal");

const profileModal =
    document.getElementById("profileModal");

const newPostBtn =
    document.getElementById("newPostBtn");

const closeModal =
    document.getElementById("closeModal");

const loginBtn =
    document.getElementById("loginBtn");

const closeLogin =
    document.getElementById("closeLogin");

const doLogin =
    document.getElementById("doLogin");

const switchAuth =
    document.getElementById("switchAuth");

const authTitle =
    document.getElementById("authTitle");

const authInfo =
    document.getElementById("authInfo");

const publishBtn =
    document.getElementById("publishBtn");

const joinBtn =
    document.getElementById("joinBtn");

const memberCount =
    document.getElementById("memberCount");

const communityBtn =
    document.getElementById("communityBtn");

const homeMenu =
    document.getElementById("homeMenu");

const hotMenu =
    document.getElementById("hotMenu");

const newMenu =
    document.getElementById("newMenu");

const profileMenu =
    document.getElementById("profileMenu");

const homeLogo =
    document.getElementById("homeLogo");


// =====================================================
// ДАННЫЕ
// =====================================================

let posts = [];

let communities = [];

let currentSort = "hot";

let currentSearch = "";

let currentCommunity = null;

let userVotes = {};

let isRegisterMode = false;


// =====================================================
// НАЧАЛЬНЫЕ ПОСТЫ
// =====================================================

const defaultPosts = [

    {
        id: 1,

        title:
            "Добро пожаловать в Leomail! 🦁",

        text:
            "Это первый пост нашего сообщества. Здесь мы будем общаться, делиться идеями и создавать новые сообщества.",

        author:
            "LeoAdmin",

        community:
            "Leomail",

        votes:
            128,

        comments: [

            {
                author: "Max",
                text: "Выглядит круто!"
            },

            {
                author: "Anna",
                text:
                    "Наконец-то новое сообщество 🧡"
            }

        ],

        createdAt:
            Date.now() - 7200000
    },

    {
        id: 2,

        title:
            "Что вы хотите увидеть в Leomail?",

        text:
            "Напишите в комментариях, какие функции нам стоит добавить следующими.",

        author:
            "LeoAdmin",

        community:
            "Leomail",

        votes:
            94,

        comments: [

            {
                author: "Alex",
                text:
                    "Добавьте личные сообщения."
            }

        ],

        createdAt:
            Date.now() - 18000000
    },

    {
        id: 3,

        title:
            "Мой первый пост",

        text:
            "Привет всем! Рад присоединиться к новому сообществу.",

        author:
            "User123",

        community:
            "Leomail",

        votes:
            57,

        comments: [],

        createdAt:
            Date.now() - 86400000
    }

];


// =====================================================
// СООБЩЕСТВА
// =====================================================

const defaultCommunities = [

    {
        name:
            "Leomail",

        description:
            "Главное сообщество Leomail. Общайтесь, публикуйте посты и находите новых людей.",

        members:
            1248,

        joined:
            false
    },

    {
        name:
            "Technology",

        description:
            "Новости технологий, компьютеров и интернета.",

        members:
            842,

        joined:
            false
    },

    {
        name:
            "Games",

        description:
            "Игры, новости, обзоры и обсуждения.",

        members:
            634,

        joined:
            false
    },

    {
        name:
            "Funny",

        description:
            "Мемы, юмор и смешные истории.",

        members:
            512,

        joined:
            false
    }

];


// =====================================================
// LOCAL STORAGE
// =====================================================

function loadData() {

    try {

        const savedPosts =
            localStorage.getItem(
                "leomail_posts"
            );

        const savedCommunities =
            localStorage.getItem(
                "leomail_communities"
            );

        const savedVotes =
            localStorage.getItem(
                "leomail_votes"
            );


        posts =
            savedPosts
                ? JSON.parse(savedPosts)
                : JSON.parse(
                    JSON.stringify(
                        defaultPosts
                    )
                );


        communities =
            savedCommunities
                ? JSON.parse(
                    savedCommunities
                )
                : JSON.parse(
                    JSON.stringify(
                        defaultCommunities
                    )
                );


        userVotes =
            savedVotes
                ? JSON.parse(savedVotes)
                : {};


    } catch (error) {

        console.error(
            "Ошибка загрузки данных:",
            error
        );


        posts =
            JSON.parse(
                JSON.stringify(
                    defaultPosts
                )
            );


        communities =
            JSON.parse(
                JSON.stringify(
                    defaultCommunities
                )
            );


        userVotes = {};

    }


    posts.forEach(post => {

        if (!Array.isArray(post.comments)) {
            post.comments = [];
        }

        if (typeof post.votes !== "number") {
            post.votes = 0;
        }

    });


    saveData();

}


function saveData() {

    localStorage.setItem(
        "leomail_posts",
        JSON.stringify(posts)
    );

    localStorage.setItem(
        "leomail_communities",
        JSON.stringify(communities)
    );

    localStorage.setItem(
        "leomail_votes",
        JSON.stringify(userVotes)
    );

}


// =====================================================
// ПРОФИЛЬ
// =====================================================

function getProfile() {

    try {

        const saved =
            localStorage.getItem(
                "leomail_profile"
            );


        if (saved) {

            return JSON.parse(
                saved
            );

        }

    } catch (error) {

        console.error(
            "Ошибка профиля:",
            error
        );

    }


    return {

        name:
            "Guest",

        bio:
            "Новый пользователь Leomail 🦁",

        avatar:
            "🦁"

    };

}


function saveProfile(profile) {

    localStorage.setItem(
        "leomail_profile",
        JSON.stringify(profile)
    );

}


function getCurrentUsername() {

    const profile =
        getProfile();

    return (
        profile.name ||
        "Guest"
    );

}


// =====================================================
// БЕЗОПАСНОСТЬ HTML
// =====================================================

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// ВРЕМЯ
// =====================================================

function getTimeText(timestamp) {

    const seconds =
        Math.floor(
            (
                Date.now() -
                timestamp
            ) / 1000
        );


    if (seconds < 60) {

        return "только что";

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (minutes < 60) {

        return (
            minutes +
            " мин. назад"
        );

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (hours < 24) {

        return (
            hours +
            " ч. назад"
        );

    }


    const days =
        Math.floor(
            hours / 24
        );


    return (
        days +
        " дн. назад"
    );

}


// =====================================================
// СТРАНИЦЫ
// =====================================================

function showHome() {

    if (homePage) {

        homePage.style.display =
            "block";

    }


    if (profilePage) {

        profilePage.classList.remove(
            "show"
        );

    }


    renderPosts();

}


function showProfile() {

    if (homePage) {

        homePage.style.display =
            "none";

    }


    if (profilePage) {

        profilePage.classList.add(
            "show"
        );

    }


    renderProfile();

}


// =====================================================
// ПОСТЫ
// =====================================================

function getVisiblePosts() {

    let result =
        [...posts];


    if (currentCommunity) {

        result =
            result.filter(
                post =>
                    post.community ===
                    currentCommunity
            );

    }


    if (currentSearch) {

        const query =
            currentSearch.toLowerCase();


        result =
            result.filter(post =>

                post.title
                    .toLowerCase()
                    .includes(query)

                ||

                post.text
                    .toLowerCase()
                    .includes(query)

                ||

                post.author
                    .toLowerCase()
                    .includes(query)

                ||

                post.community
                    .toLowerCase()
                    .includes(query)

            );

    }


    if (currentSort === "new") {

        result.sort(
            (a, b) =>
                b.createdAt -
                a.createdAt
        );

    }

    else if (currentSort === "top") {

        result.sort(
            (a, b) =>
                b.votes -
                a.votes
        );

    }

    else {

        result.sort(
            (a, b) => {

                const ageA =
                    Math.max(
                        1,
                        (
                            Date.now() -
                            a.createdAt
                        ) / 3600000
                    );


                const ageB =
                    Math.max(
                        1,
                        (
                            Date.now() -
                            b.createdAt
                        ) / 3600000
                    );


                const scoreA =
                    a.votes /
                    Math.pow(
                        ageA + 2,
                        0.6
                    );


                const scoreB =
                    b.votes /
                    Math.pow(
                        ageB + 2,
                        0.6
                    );


                return (
                    scoreB -
                    scoreA
                );

            }
        );

    }


    return result;

}


// =====================================================
// ОТОБРАЖЕНИЕ ПОСТОВ
// =====================================================

function renderPosts() {

    if (!postsContainer) {
        return;
    }


    const visiblePosts =
        getVisiblePosts();


    postsContainer.innerHTML =
        "";


    if (
        visiblePosts.length === 0
    ) {

        postsContainer.innerHTML = `

            <div class="post">

                <div class="post-body">

                    <h2 class="post-title">
                        Здесь пока пусто
                    </h2>

                    <div class="post-text">
                        Создайте первый пост!
                    </div>

                </div>

            </div>

        `;

        return;

    }


    visiblePosts.forEach(
        post => {

            const article =
                document.createElement(
                    "article"
                );


            article.className =
                "post";


            const vote =
                userVotes[post.id] ||
                0;


            article.innerHTML = `

                <div class="vote">

                    <button
                        class="upvote ${
                            vote === 1
                                ? "voted"
                                : ""
                        }"
                        data-id="${post.id}"
                    >
                        ▲
                    </button>

                    <div class="vote-count">
                        ${post.votes}
                    </div>

                    <button
                        class="downvote ${
                            vote === -1
                                ? "voted"
                                : ""
                        }"
                        data-id="${post.id}"
                    >
                        ▼
                    </button>

                </div>


                <div class="post-body">

                    <div class="post-meta">

                        🟠

                        <button
                            class="community-link"
                            data-community="${escapeHTML(
                                post.community
                            )}"
                        >
                            r/${escapeHTML(
                                post.community
                            )}
                        </button>

                        ·

                        <button
                            class="author-link"
                        >
                            u/${escapeHTML(
                                post.author
                            )}
                        </button>

                        ·

                        ${getTimeText(
                            post.createdAt
                        )}

                    </div>


                    <h2 class="post-title">
                        ${escapeHTML(
                            post.title
                        )}
                    </h2>


                    <div class="post-text">
                        ${escapeHTML(
                            post.text
                        )}
                    </div>


                    <div class="post-actions">

                        <button
                            class="post-action comment-btn"
                            data-id="${post.id}"
                        >
                            💬
                            ${
                                post.comments.length
                            }
                            комментариев
                        </button>


                        <button
                            class="post-action share-btn"
                            data-id="${post.id}"
                        >
                            ↗ Поделиться
                        </button>

                    </div>


                    <div
                        class="comments"
                        id="comments-${post.id}"
                    >

                        ${renderComments(post)}


                        <div class="comment-form">

                            <input
                                class="comment-input"
                                data-id="${post.id}"
                                maxlength="500"
                                placeholder="Написать комментарий..."
                            >

                            <button
                                class="comment-submit"
                                data-id="${post.id}"
                            >
                                Отправить
                            </button>

                        </div>

                    </div>

                </div>

            `;


            postsContainer.appendChild(
                article
            );

        }
    );


    attachPostEvents();

}


// =====================================================
// КОММЕНТАРИИ
// =====================================================

function renderComments(post) {

    if (
        !post.comments ||
        post.comments.length === 0
    ) {

        return `
            <p style="color:#888">
                Пока нет комментариев.
            </p>
        `;

    }


    return post.comments
        .map(
            comment => `

                <div class="comment">

                    <div class="comment-user">
                        u/${escapeHTML(
                            comment.author
                        )}
                    </div>

                    <div class="comment-text">
                        ${escapeHTML(
                            comment.text
                        )}
                    </div>

                </div>

            `
        )
        .join("");

}


function addComment(id) {

    const input =
        document.querySelector(
            `.comment-input[data-id="${id}"]`
        );


    if (!input) {
        return;
    }


    const text =
        input.value.trim();


    if (!text) {
        return;
    }


    const post =
        posts.find(
            item =>
                item.id === id
        );


    if (!post) {
        return;
    }


    post.comments.push({

        author:
            getCurrentUsername(),

        text:
            text

    });


    saveData();

    renderPosts();

}


// =====================================================
// ГОЛОСОВАНИЕ
// =====================================================

function votePost(
    postId,
    newVote
) {

    const post =
        posts.find(
            item =>
                item.id === postId
        );


    if (!post) {
        return;
    }


    const currentVote =
        userVotes[postId] ||
        0;


    if (
        currentVote ===
        newVote
    ) {

        if (newVote === 1) {
            post.votes--;
        }

        if (newVote === -1) {
            post.votes++;
        }


        delete userVotes[postId];

    }

    else if (
        currentVote !== 0
    ) {

        if (
            currentVote === 1 &&
            newVote === -1
        ) {

            post.votes -= 2;

        }

        else if (
            currentVote === -1 &&
            newVote === 1
        ) {

            post.votes += 2;

        }


        userVotes[postId] =
            newVote;

    }

    else {

        if (newVote === 1) {
            post.votes++;
        }

        if (newVote === -1) {
            post.votes--;
        }


        userVotes[postId] =
            newVote;

    }


    saveData();

    renderPosts();

}


// =====================================================
// СОБЫТИЯ ПОСТОВ
// =====================================================

function attachPostEvents() {

    document
        .querySelectorAll(
            ".upvote"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        votePost(
                            Number(
                                button.dataset.id
                            ),
                            1
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".downvote"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        votePost(
                            Number(
                                button.dataset.id
                            ),
                            -1
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".comment-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const box =
                            document.getElementById(
                                "comments-" +
                                button.dataset.id
                            );


                        if (box) {

                            box.classList.toggle(
                                "open"
                            );

                        }

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".comment-submit"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        addComment(
                            Number(
                                button.dataset.id
                            )
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".comment-input"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "keydown",
                    event => {

                        if (
                            event.key ===
                            "Enter"
                        ) {

                            event.preventDefault();

                            addComment(
                                Number(
                                    input.dataset.id
                                )
                            );

                        }

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".community-link"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openCommunity(
                            button.dataset.community
                        );

                    }
                );

            }
        );


    document
        .querySelectorAll(
            ".author-link"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    showProfile
                );

            }
        );


    document
        .querySelectorAll(
            ".share-btn"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const post =
                            posts.find(
                                item =>
                                    item.id ===
                                    Number(
                                        button.dataset.id
                                    )
                            );


                        if (!post) {
                            return;
                        }


                        const text =
                            post.title +
                            "\n\n" +
                            post.text;


                        try {

                            await navigator.clipboard.writeText(
                                text
                            );


                            button.textContent =
                                "✓ Скопировано";


                            setTimeout(
                                () => {

                                    button.textContent =
                                        "↗ Поделиться";

                                },
                                1500
                            );

                        }

                        catch {

                            alert(
                                "Не удалось скопировать текст."
                            );

                        }

                    }
                );

            }
        );

}


// =====================================================
// СОЗДАНИЕ ПОСТА
// =====================================================

if (newPostBtn) {

    newPostBtn.addEventListener(
        "click",
        () => {

            postModal.classList.add(
                "show"
            );

            updatePostCommunity();

        }
    );

}


if (closeModal) {

    closeModal.addEventListener(
        "click",
        () => {

            postModal.classList.remove(
                "show"
            );

        }
    );

}


function updatePostCommunity() {

    const communityText =
        document.querySelector(
            ".modal-bottom span"
        );


    if (!communityText) {
        return;
    }


    communityText.textContent =
        "🟠 r/" +
        (
            currentCommunity ||
            "Leomail"
        );

}


if (publishBtn) {

    publishBtn.addEventListener(
        "click",
        () => {

            const title =
                document
                    .getElementById(
                        "postTitle"
                    )
                    .value
                    .trim();


            const text =
                document
                    .getElementById(
                        "postText"
                    )
                    .value
                    .trim();


            if (!title) {

                alert(
                    "Введите заголовок."
                );

                return;

            }


            if (!text) {

                alert(
                    "Напишите текст поста."
                );

                return;

            }


            const newPost = {

                id:
                    Date.now(),

                title:
                    title,

                text:
                    text,

                author:
                    getCurrentUsername(),

                community:
                    currentCommunity ||
                    "Leomail",

                votes:
                    1,

                comments:
                    [],

                createdAt:
                    Date.now()

            };


            posts.unshift(
                newPost
            );


            userVotes[
                newPost.id
            ] = 1;


            saveData();


            document.getElementById(
                "postTitle"
            ).value = "";


            document.getElementById(
                "postText"
            ).value = "";


            postModal.classList.remove(
                "show"
            );


            currentSort =
                "new";


            updateSortButtons();

            renderPosts();

        }
    );

}


// =====================================================
// ПОИСК
// =====================================================

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            currentSearch =
                searchInput.value.trim();

            renderPosts();

        }
    );

}


// =====================================================
// СОРТИРОВКА
// =====================================================

document
    .querySelectorAll(
        ".sort"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    currentSort =
                        button.dataset.sort;

                    updateSortButtons();

                    renderPosts();

                }
            );

        }
    );


function updateSortButtons() {

    document
        .querySelectorAll(
            ".sort"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.sort ===
                    currentSort
                );

            }
        );

}


// =====================================================
// МЕНЮ
// =====================================================

if (homeMenu) {

    homeMenu.addEventListener(
        "click",
        () => {

            currentCommunity =
                null;

            currentSearch =
                "";

            if (searchInput) {
                searchInput.value =
                    "";
            }

            showHome();

        }
    );

}


if (hotMenu) {

    hotMenu.addEventListener(
        "click",
        () => {

            currentCommunity =
                null;

            currentSort =
                "hot";

            updateSortButtons();

            showHome();

        }
    );

}


if (newMenu) {

    newMenu.addEventListener(
        "click",
        () => {

            currentCommunity =
                null;

            currentSort =
                "new";

            updateSortButtons();

            showHome();

        }
    );

}


if (profileMenu) {

    profileMenu.addEventListener(
        "click",
        showProfile
    );

}


if (homeLogo) {

    homeLogo.addEventListener(
        "click",
        event => {

            event.preventDefault();

            currentCommunity =
                null;

            showHome();

        }
    );

}


// =====================================================
// СООБЩЕСТВА
// =====================================================

function openCommunity(name) {

    const community =
        communities.find(
            item =>
                item.name.toLowerCase() ===
                name.toLowerCase()
        );


    if (!community) {
        return;
    }


    currentCommunity =
        community.name;


    updateCommunityCard();

    updatePostCommunity();

    renderPosts();

}


function updateCommunityCard() {

    const name =
        currentCommunity ||
        "Leomail";


    const community =
        communities.find(
            item =>
                item.name === name
        );


    if (!community) {
        return;
    }


    const title =
        document.querySelector(
            ".community-content h2"
        );


    const description =
        document.querySelector(
            ".community-content p"
        );


    if (title) {

        title.textContent =
            "r/" +
            community.name;

    }


    if (description) {

        description.textContent =
            community.description;

    }


    if (memberCount) {

        memberCount.textContent =
            community.members.toLocaleString(
                "ru-RU"
            );

    }


    if (joinBtn) {

        joinBtn.textContent =
            community.joined
                ? "✓ Вы участник"
                : "Присоединиться";


        joinBtn.classList.toggle(
            "joined",
            community.joined
        );

    }

}


if (joinBtn) {

    joinBtn.addEventListener(
        "click",
        () => {

            const name =
                currentCommunity ||
                "Leomail";


            const community =
                communities.find(
                    item =>
                        item.name === name
                );


            if (!community) {
                return;
            }


            if (community.joined) {

                community.joined =
                    false;

                community.members =
                    Math.max(
                        0,
                        community.members - 1
                    );

            }

            else {

                community.joined =
                    true;

                community.members++;

            }


            saveData();

            updateCommunityCard();

        }
    );

}


// =====================================================
// СОЗДАНИЕ СООБЩЕСТВА
// =====================================================

if (communityBtn) {

    communityBtn.addEventListener(
        "click",
        () => {

            const name =
                prompt(
                    "Введите название сообщества:"
                );


            if (!name) {
                return;
            }


            const cleanName =
                name
                    .trim()
                    .replace(
                        /^r\//i,
                        ""
                    )
                    .replace(
                        /\s+/g,
                        ""
                    );


            if (
                cleanName.length < 3
            ) {

                alert(
                    "Название должно содержать минимум 3 символа."
                );

                return;
            }


            const exists =
                communities.some(
                    community =>
                        community.name.toLowerCase() ===
                        cleanName.toLowerCase()
                );


            if (exists) {

                alert(
                    "Такое сообщество уже существует."
                );

                return;
            }


            const description =
                prompt(
                    "Введите описание сообщества:"
                ) ||
                "Новое сообщество Leomail.";


            const newCommunity = {

                name:
                    cleanName,

                description:
                    description,

                members:
                    1,

                joined:
                    true

            };


            communities.push(
                newCommunity
            );


            saveData();

            addCommunityToSidebar(
                newCommunity
            );


            openCommunity(
                newCommunity.name
            );


            alert(
                "Сообщество r/" +
                newCommunity.name +
                " создано!"
            );

        }
    );

}


function addCommunityToSidebar(
    community
) {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );


    const createButton =
        document.getElementById(
            "communityBtn"
        );


    if (
        !sidebar ||
        !createButton
    ) {
        return;
    }


    const button =
        document.createElement(
            "button"
        );


    button.className =
        "side-item";


    button.textContent =
        "🟠 r/" +
        community.name;


    button.addEventListener(
        "click",
        () => {

            openCommunity(
                community.name
            );

        }
    );


    sidebar.insertBefore(
        button,
        createButton
    );

}


// =====================================================
// ПРОФИЛЬ
// =====================================================

function renderProfile() {

    const profile =
        getProfile();


    const profileAvatar =
        document.getElementById(
            "profileAvatar"
        );


    const profileName =
        document.getElementById(
            "profileName"
        );


    const profileUsername =
        document.getElementById(
            "profileUsername"
        );


    const profileBio =
        document.getElementById(
            "profileBio"
        );


    if (profileAvatar) {

        profileAvatar.textContent =
            profile.avatar;

    }


    if (profileName) {

        profileName.textContent =
            profile.name;

    }


    if (profileUsername) {

        profileUsername.textContent =
            "u/" +
            profile.name;

    }


    if (profileBio) {

        profileBio.textContent =
            profile.bio;

    }


    const userPosts =
        posts.filter(
            post =>
                post.author ===
                profile.name
        );


    const karma =
        userPosts.reduce(
            (sum, post) =>
                sum +
                post.votes,
            0
        );


    const comments =
        userPosts.reduce(
            (sum, post) =>
                sum +
                post.comments.length,
            0
        );


    const profileKarma =
        document.getElementById(
            "profileKarma"
        );


    const profilePosts =
        document.getElementById(
            "profilePosts"
        );


    const profileComments =
        document.getElementById(
            "profileComments"
        );


    if (profileKarma) {

        profileKarma.textContent =
            karma;

    }


    if (profilePosts) {

        profilePosts.textContent =
            userPosts.length;

    }


    if (profileComments) {

        profileComments.textContent =
            comments;

    }


    const list =
        document.getElementById(
            "profilePostsList"
        );


    if (!list) {
        return;
    }


    if (
        userPosts.length === 0
    ) {

        list.innerHTML = `

            <div class="no-profile-posts">
                У пользователя пока нет постов.
            </div>

        `;

        return;

    }


    list.innerHTML =
        userPosts
            .map(
                post => `

                    <div class="profile-post">

                        <div class="post-meta">
                            🟠 r/${escapeHTML(
                                post.community
                            )}
                        </div>

                        <h3>
                            ${escapeHTML(
                                post.title
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                post.text
                            )}
                        </p>

                    </div>

                `
            )
            .join("");

}


// =====================================================
// РЕДАКТИРОВАНИЕ ПРОФИЛЯ
// =====================================================

const editProfileBtn =
    document.getElementById(
        "editProfileBtn"
    );


const closeProfileModal =
    document.getElementById(
        "closeProfileModal"
    );


const saveProfileBtn =
    document.getElementById(
        "saveProfileBtn"
    );


let selectedAvatar =
    "🦁";


if (editProfileBtn) {

    editProfileBtn.addEventListener(
        "click",
        () => {

            const profile =
                getProfile();


            document.getElementById(
                "editName"
            ).value =
                profile.name;


            document.getElementById(
                "editBio"
            ).value =
                profile.bio;


            selectedAvatar =
                profile.avatar;


            document
                .querySelectorAll(
                    "#avatarPicker button"
                )
                .forEach(
                    button => {

                        button.classList.toggle(
                            "selected",
                            button.dataset.avatar ===
                            profile.avatar
                        );

                    }
                );


            profileModal.classList.add(
                "show"
            );

        }
    );

}


if (closeProfileModal) {

    closeProfileModal.addEventListener(
        "click",
        () => {

            profileModal.classList.remove(
                "show"
            );

        }
    );

}


document
    .querySelectorAll(
        "#avatarPicker button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    selectedAvatar =
                        button.dataset.avatar;


                    document
                        .querySelectorAll(
                            "#avatarPicker button"
                        )
                        .forEach(
                            item =>
                                item.classList.remove(
                                    "selected"
                                )
                        );


                    button.classList.add(
                        "selected"
                    );

                }
            );

        }
    );


if (saveProfileBtn) {

    saveProfileBtn.addEventListener(
        "click",
        () => {

            const oldProfile =
                getProfile();


            const name =
                document
                    .getElementById(
                        "editName"
                    )
                    .value
                    .trim();


            const bio =
                document
                    .getElementById(
                        "editBio"
                    )
                    .value
                    .trim();


            if (!name) {

                alert(
                    "Введите имя."
                );

                return;
            }


            const newProfile = {

                name:
                    name,

                bio:
                    bio ||
                    "Новый пользователь Leomail 🦁",

                avatar:
                    selectedAvatar

            };


            posts.forEach(
                post => {

                    if (
                        post.author ===
                        oldProfile.name
                    ) {

                        post.author =
                            name;

                    }

                }
            );


            saveProfile(
                newProfile
            );


            saveData();


            profileModal.classList.remove(
                "show"
            );


            renderProfile();

        }
    );

}


// =====================================================
// АВТОРИЗАЦИЯ
// =====================================================

function openLogin() {

    if (!loginModal) {
        return;
    }


    isRegisterMode =
        false;


    updateAuthMode();


    loginModal.classList.add(
        "show"
    );

}


if (loginBtn) {

    loginBtn.addEventListener(
        "click",
        openLogin
    );

}


if (closeLogin) {

    closeLogin.addEventListener(
        "click",
        () => {

            loginModal.classList.remove(
                "show"
            );

        }
    );

}


// =====================================================
// ПЕРЕКЛЮЧЕНИЕ ВХОД / РЕГИСТРАЦИЯ
// =====================================================

if (switchAuth) {

    switchAuth.addEventListener(
        "click",
        () => {

            isRegisterMode =
                !isRegisterMode;

            updateAuthMode();

        }
    );

}


function updateAuthMode() {

    if (!authTitle) {
        return;
    }


    const password =
        document.getElementById(
            "password"
        );


    if (isRegisterMode) {

        authTitle.textContent =
            "Регистрация в Leomail";


        doLogin.textContent =
            "Зарегистрироваться";


        switchAuth.textContent =
            "Уже есть аккаунт? Войти";


        authInfo.textContent =
            "Создайте аккаунт Leomail.";


        if (password) {

            password.placeholder =
                "Пароль (минимум 6 символов)";

        }

    }

    else {

        authTitle.textContent =
            "Войти в Leomail";


        doLogin.textContent =
            "Войти";


        switchAuth.textContent =
            "Нет аккаунта? Зарегистрироваться";


        authInfo.textContent =
            "Войдите в свой аккаунт Leomail.";


        if (password) {

            password.placeholder =
                "Пароль";

        }

    }

}


// =====================================================
// РЕГИСТРАЦИЯ / ВХОД ЧЕРЕЗ СЕРВЕР
// =====================================================

if (doLogin) {

    doLogin.addEventListener(
        "click",
        async () => {

            const usernameInput =
                document.getElementById(
                    "username"
                );


            const passwordInput =
                document.getElementById(
                    "password"
                );


            const username =
                usernameInput.value.trim();


            const password =
                passwordInput.value;


            if (!username) {

                alert(
                    "Введите имя пользователя."
                );

                return;

            }


            if (!password) {

                alert(
                    "Введите пароль."
                );

                return;

            }


            doLogin.disabled =
                true;


            doLogin.textContent =
                "Подождите...";


            try {

                const endpoint =
                    isRegisterMode
                        ? "/api/register"
                        : "/api/login";


                const response =
                    await fetch(
                        endpoint,
                        {

                            method:
                                "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    username:
                                        username,

                                    password:
                                        password
                                })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    alert(
                        data.message ||
                        "Произошла ошибка."
                    );

                    return;

                }


                // =================================
                // УСПЕШНАЯ АВТОРИЗАЦИЯ
                // =================================

                localStorage.setItem(
                    "leomail_user",
                    data.user.username
                );


                const profile =
                    getProfile();


                profile.name =
                    data.user.username;


                saveProfile(
                    profile
                );


                loginModal.classList.remove(
                    "show"
                );


                usernameInput.value =
                    "";


                passwordInput.value =
                    "";


                updateLoginButton();

                renderProfile();

                renderPosts();


                alert(
                    isRegisterMode
                        ? "Регистрация успешна! 🦁"
                        : "Вы вошли в Leomail! 🦁"
                );

            }

            catch (error) {

                console.error(
                    "Ошибка подключения:",
                    error
                );


                alert(
                    "Не удалось подключиться к серверу. Убедитесь, что сервер запущен."
                );

            }

            finally {

                doLogin.disabled =
                    false;


                updateAuthMode();

            }

        }
    );

}


// =====================================================
// КНОПКА ПОЛЬЗОВАТЕЛЯ
// =====================================================

function updateLoginButton() {

    if (!loginBtn) {
        return;
    }


    const user =
        localStorage.getItem(
            "leomail_user"
        );


    if (user) {

        loginBtn.textContent =
            "👤 " +
            user;

    }

    else {

        loginBtn.textContent =
            "Войти";

    }

}


// =====================================================
// ESC
// =====================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }


        document
            .querySelectorAll(
                ".modal"
            )
            .forEach(
                modal =>
                    modal.classList.remove(
                        "show"
                    )
            );

    }
);


// =====================================================
// ЗАКРЫТИЕ MODAL ПО ФОНУ
// =====================================================

document
    .querySelectorAll(
        ".modal"
    )
    .forEach(
        modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );

                    }

                }
            );

        }
    );


// =====================================================
// ВОССТАНОВЛЕНИЕ СООБЩЕСТВ
// =====================================================

function restoreCustomCommunities() {

    communities.forEach(
        community => {

            const exists =
                [
                    ...document.querySelectorAll(
                        ".sidebar .side-item"
                    )
                ]
                .some(
                    button =>
                        button.textContent.includes(
                            "r/" +
                            community.name
                        )
                );


            if (!exists) {

                addCommunityToSidebar(
                    community
                );

            }

        }
    );

}


// =====================================================
// ЗАПУСК
// =====================================================

loadData();

updateLoginButton();

updateSortButtons();

restoreCustomCommunities();

renderPosts();

updateCommunityCard();


// =====================================================
// ГОТОВО
// =====================================================

console.log(
    "Leomail frontend запущен 🦁"
);