"use strict";

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
    console.error("ОШИБКА: настрой DATABASE_URL в Render.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false }
});

app.use(express.json({ limit: "100kb" }));
app.use(express.static(__dirname));

function makeId() {
    return crypto.randomUUID();
}

function cleanString(value, maxLength) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function sendError(res, error, message) {
    console.error(message, error);
    return res.status(500).json({
        success: false,
        message: "Ошибка сервера."
    });
}

// =====================================================
// ИНИЦИАЛИЗАЦИЯ БАЗЫ
// =====================================================

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            username_lower TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            bio TEXT NOT NULL DEFAULT 'Новый пользователь Leomail 🦁',
            avatar TEXT NOT NULL DEFAULT '🦁',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS communities (
            name TEXT PRIMARY KEY,
            description TEXT NOT NULL DEFAULT '',
            created_by TEXT NOT NULL DEFAULT 'LeoAdmin',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            author TEXT NOT NULL,
            community TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            author TEXT NOT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS votes (
            post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
            voter TEXT NOT NULL,
            value INTEGER NOT NULL CHECK (value IN (-1, 1)),
            PRIMARY KEY (post_id, voter)
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS community_members (
            community_name TEXT NOT NULL
                REFERENCES communities(name) ON DELETE CASCADE,
            username TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (community_name, username)
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS posts_created_at_idx
        ON posts (created_at DESC)
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS comments_post_id_idx
        ON comments (post_id, created_at)
    `);

    const defaults = [
        [
            "Leomail",
            "Главное сообщество Leomail. Общайтесь, публикуйте посты и находите новых людей."
        ],
        [
            "Technology",
            "Новости технологий, компьютеров и интернета."
        ],
        [
            "Games",
            "Игры, новости, обзоры и обсуждения."
        ],
        [
            "Funny",
            "Мемы, юмор и смешные истории."
        ]
    ];

    for (const [name, description] of defaults) {
        await pool.query(
            `INSERT INTO communities (name, description)
             VALUES ($1, $2)
             ON CONFLICT (name) DO NOTHING`,
            [name, description]
        );
    }

    console.log("База данных Leomail готова.");
}

// =====================================================
// ГЛАВНАЯ И СТАТУС
// =====================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/status", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({
            success: true,
            message: "Leomail server работает! 🦁"
        });
    } catch (error) {
        sendError(res, error, "Ошибка проверки сервера:");
    }
});

// =====================================================
// РЕГИСТРАЦИЯ
// =====================================================

app.post("/api/register", async (req, res) => {
    try {
        const username = cleanString(req.body?.username, 30);
        const password = req.body?.password;

        if (username.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Имя должно содержать от 3 до 30 символов."
            });
        }

        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(username)) {
            return res.status(400).json({
                success: false,
                message: "Имя может содержать только буквы, цифры и _."
            });
        }

        if (
            typeof password !== "string" ||
            password.length < 6 ||
            password.length > 200
        ) {
            return res.status(400).json({
                success: false,
                message: "Пароль должен содержать от 6 до 200 символов."
            });
        }

        const hash = await bcrypt.hash(password, 10);
        const id = makeId();

        const result = await pool.query(
            `INSERT INTO users
                (id, username, username_lower, password_hash)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username_lower) DO NOTHING
             RETURNING id, username`,
            [id, username, username.toLowerCase(), hash]
        );

        if (!result.rowCount) {
            return res.status(409).json({
                success: false,
                message: "Такой пользователь уже существует."
            });
        }

        res.status(201).json({
            success: true,
            message: "Регистрация успешна! 🦁",
            user: result.rows[0]
        });
    } catch (error) {
        sendError(res, error, "Ошибка регистрации:");
    }
});

// =====================================================
// ВХОД
// =====================================================

app.post("/api/login", async (req, res) => {
    try {
        const username = cleanString(req.body?.username, 30);
        const password = req.body?.password;

        if (!username || typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Введите имя пользователя и пароль."
            });
        }

        const result = await pool.query(
            `SELECT id, username, password_hash
             FROM users
             WHERE username_lower = $1`,
            [username.toLowerCase()]
        );

        if (!result.rowCount) {
            return res.status(401).json({
                success: false,
                message: "Неверное имя пользователя или пароль."
            });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!valid) {
            return res.status(401).json({
                success: false,
                message: "Неверное имя пользователя или пароль."
            });
        }

        res.json({
            success: true,
            message: "Вход выполнен! 🦁",
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        sendError(res, error, "Ошибка входа:");
    }
});
// =====================================================
// ЗАГРУЗКА ПОСТОВ, КОММЕНТАРИЕВ И ГОЛОСОВ
// =====================================================

app.get("/api/posts", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                p.id,
                p.title,
                p.body AS text,
                p.author,
                p.community,
                FLOOR(EXTRACT(EPOCH FROM p.created_at) * 1000)
                    AS "createdAt",
                COALESCE(v.score, 0)::int AS votes,
                COALESCE(c.items, '[]'::json)::json AS comments
            FROM posts p
            LEFT JOIN (
                SELECT post_id, SUM(value)::int AS score
                FROM votes
                GROUP BY post_id
            ) v ON v.post_id = p.id
            LEFT JOIN (
                SELECT post_id, json_agg(
                    json_build_object(
                        'id', id,
                        'author', author,
                        'text', body,
                        'createdAt',
                        FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)
                    ) ORDER BY created_at
                ) AS items
                FROM comments
                GROUP BY post_id
            ) c ON c.post_id = p.id
            ORDER BY p.created_at DESC
            LIMIT 500
        `);

        res.set("Cache-Control", "no-store");
        res.json({
            success: true,
            posts: result.rows
        });
    } catch (error) {
        sendError(res, error, "Ошибка загрузки постов:");
    }
});

// =====================================================
// СОЗДАНИЕ ПОСТА
// =====================================================

app.post("/api/posts", async (req, res) => {
    try {
        const title = cleanString(req.body?.title, 200);
        const text = cleanString(req.body?.text, 20000);
        const author = cleanString(req.body?.author, 30);
        const community = cleanString(
            req.body?.community || "Leomail",
            50
        );

        if (!title || !text || !author || !community) {
            return res.status(400).json({
                success: false,
                message: "Заполни заголовок, текст, имя и сообщество."
            });
        }

        const exists = await pool.query(
            "SELECT name FROM communities WHERE name = $1",
            [community]
        );

        if (!exists.rowCount) {
            return res.status(400).json({
                success: false,
                message: "Такого сообщества не существует."
            });
        }

        const result = await pool.query(
            `INSERT INTO posts
                (id, title, body, author, community)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, body AS text, author,
                       community,
                       FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)
                           AS "createdAt"`,
            [makeId(), title, text, author, community]
        );

        res.status(201).json({
            success: true,
            post: {
                ...result.rows[0],
                votes: 0,
                comments: []
            }
        });
    } catch (error) {
        sendError(res, error, "Ошибка создания поста:");
    }
});

// =====================================================
// ДОБАВЛЕНИЕ КОММЕНТАРИЯ
// =====================================================

app.post("/api/posts/:id/comments", async (req, res) => {
    try {
        const postId = cleanString(req.params.id, 100);
        const author = cleanString(req.body?.author, 30);
        const text = cleanString(req.body?.text, 500);

        if (!author || !text) {
            return res.status(400).json({
                success: false,
                message: "Введите имя и комментарий."
            });
        }

        const result = await pool.query(
            `INSERT INTO comments (id, post_id, author, body)
             VALUES ($1, $2, $3, $4)
             RETURNING id, author, body AS text,
                       FLOOR(EXTRACT(EPOCH FROM created_at) * 1000)
                           AS "createdAt"`,
            [makeId(), postId, author, text]
        );

        res.status(201).json({
            success: true,
            comment: result.rows[0]
        });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(404).json({
                success: false,
                message: "Пост не найден."
            });
        }

        sendError(res, error, "Ошибка комментария:");
    }
});

// =====================================================
// ГОЛОСОВАНИЕ
// =====================================================

app.post("/api/posts/:id/vote", async (req, res) => {
    const client = await pool.connect();

    try {
        const postId = cleanString(req.params.id, 100);
        const username = cleanString(req.body?.username, 30);
        const value = Number(req.body?.value);

        if (!username || ![-1, 0, 1].includes(value)) {
            return res.status(400).json({
                success: false,
                message: "Некорректный голос."
            });
        }

        await client.query("BEGIN");

        if (value === 0) {
            await client.query(
                `DELETE FROM votes
                 WHERE post_id = $1 AND voter = $2`,
                [postId, username.toLowerCase()]
            );
        } else {
            await client.query(
                `INSERT INTO votes (post_id, voter, value)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (post_id, voter)
                 DO UPDATE SET value = EXCLUDED.value`,
                [postId, username.toLowerCase(), value]
            );
        }

        const result = await client.query(
            `SELECT COALESCE(SUM(value), 0)::int AS votes
             FROM votes
             WHERE post_id = $1`,
            [postId]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            votes: result.rows[0].votes
        });
    } catch (error) {
        await client.query("ROLLBACK");

        if (error.code === "23503") {
            return res.status(404).json({
                success: false,
                message: "Пост не найден."
            });
        }

        sendError(res, error, "Ошибка голосования:");
    } finally {
        client.release();
    }
});

// =====================================================
// СПИСОК СООБЩЕСТВ
// =====================================================

app.get("/api/communities", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.name,
                c.description,
                COUNT(m.username)::int AS members
            FROM communities c
            LEFT JOIN community_members m
                ON m.community_name = c.name
            GROUP BY c.name, c.description
            ORDER BY c.created_at
        `);

        res.json({
            success: true,
            communities: result.rows
        });
    } catch (error) {
        sendError(res, error, "Ошибка сообществ:");
    }
});

// =====================================================
// СОЗДАНИЕ СООБЩЕСТВА
// =====================================================

app.post("/api/communities", async (req, res) => {
    try {
        const name = cleanString(req.body?.name, 50);
        const description = cleanString(
            req.body?.description || "",
            500
        );
        const author = cleanString(req.body?.author, 30);

        if (
            name.length < 3 ||
            !/^[a-zA-Zа-яА-ЯёЁ0-9_-]+$/.test(name)
        ) {
            return res.status(400).json({
                success: false,
                message: "Название сообщества некорректно."
            });
        }

        if (!author) {
            return res.status(400).json({
                success: false,
                message: "Не указано имя создателя."
            });
        }

        const result = await pool.query(
            `INSERT INTO communities (name, description, created_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (name) DO NOTHING
             RETURNING name, description`,
            [name, description, author]
        );

        if (!result.rowCount) {
            return res.status(409).json({
                success: false,
                message: "Такое сообщество уже существует."
            });
        }

        await pool.query(
            `INSERT INTO community_members (community_name, username)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [name, author.toLowerCase()]
        );

        res.status(201).json({
            success: true,
            community: {
                ...result.rows[0],
                members: 1,
                joined: true
            }
        });
    } catch (error) {
        sendError(res, error, "Ошибка создания сообщества:");
    }
});

// =====================================================
// ВСТУПЛЕНИЕ И ВЫХОД ИЗ СООБЩЕСТВА
// =====================================================

app.post("/api/communities/:name/join", async (req, res) => {
    try {
        const name = cleanString(req.params.name, 50);
        const username = cleanString(req.body?.username, 30);
        const joined = req.body?.joined === true;

        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Укажи имя пользователя."
            });
        }

        if (joined) {
            await pool.query(
                `INSERT INTO community_members
                    (community_name, username)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [name, username.toLowerCase()]
            );
        } else {
            await pool.query(
                `DELETE FROM community_members
                 WHERE community_name = $1 AND username = $2`,
                [name, username.toLowerCase()]
            );
        }

        const result = await pool.query(
            `SELECT COUNT(*)::int AS members
             FROM community_members
             WHERE community_name = $1`,
            [name]
        );

        res.json({
            success: true,
            joined,
            members: result.rows[0].members
        });
    } catch (error) {
        sendError(res, error, "Ошибка участия в сообществе:");
    }
});

// =====================================================
// ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ
// =====================================================

app.get("/api/users/:username", async (req, res) => {
    try {
        const username = cleanString(req.params.username, 30);

        const result = await pool.query(
            `SELECT username, bio, avatar
             FROM users
             WHERE username_lower = $1`,
            [username.toLowerCase()]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Пользователь не найден."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        sendError(res, error, "Ошибка загрузки профиля:");
    }
});

app.put("/api/users/:username", async (req, res) => {
    try {
        const username = cleanString(req.params.username, 30);
        const bio = cleanString(req.body?.bio || "", 300);
        const avatar = cleanString(req.body?.avatar || "🦁", 20);

        const result = await pool.query(
            `UPDATE users
             SET bio = $2, avatar = $3
             WHERE username_lower = $1
             RETURNING username, bio, avatar`,
            [username.toLowerCase(), bio, avatar]
        );

        if (!result.rowCount) {
            return res.status(404).json({
                success: false,
                message: "Пользователь не найден."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        sendError(res, error, "Ошибка сохранения профиля:");
    }
});

// =====================================================
// ОБРАБОТКА ОШИБОК
// =====================================================

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Некорректный JSON."
        });
    }

    sendError(res, err, "Необработанная ошибка:");
});

// =====================================================
// ЗАПУСК СЕРВЕРА
// =====================================================

async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("=================================");
            console.log("       LEOMAIL SERVER 🦁");
            console.log("=================================");
            console.log("Порт:", PORT);
            console.log("Сервер запущен!");
        });
    } catch (error) {
        console.error("Не удалось запустить сервер:", error);
        process.exit(1);
    }
}

process.on("SIGTERM", async () => {
    await pool.end();
    process.exit(0);
});

startServer();
