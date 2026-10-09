"use strict";

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
    console.error("ОШИБКА: на Render не задан DATABASE_URL.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false }
});

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// СОЗДАНИЕ ТАБЛИЦ
// ==========================================

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            username_lower TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            message_text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS messages_created_at_idx
        ON messages (created_at DESC)
    `);

    console.log("База данных Leomail готова.");
}

// ==========================================
// СТАТУС СЕРВЕРА
// ==========================================

app.get("/api/status", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            message: "Leomail server работает! 🦁"
        });
    } catch (error) {
        console.error("Ошибка статуса:", error.message);

        res.status(500).json({
            success: false,
            message: "База данных недоступна."
        });
    }
});

// ==========================================
// РЕГИСТРАЦИЯ
// ==========================================

app.post("/api/register", async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (
            typeof username !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Введите имя пользователя и пароль."
            });
        }

        const cleanUsername = username.trim();

        if (
            cleanUsername.length < 3 ||
            cleanUsername.length > 30
        ) {
            return res.status(400).json({
                success: false,
                message: "Имя должно содержать от 3 до 30 символов."
            });
        }

        if (!/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(cleanUsername)) {
            return res.status(400).json({
                success: false,
                message: "Имя может содержать только буквы, цифры и _."
            });
        }

        if (password.length < 6 || password.length > 200) {
            return res.status(400).json({
                success: false,
                message: "Пароль должен содержать от 6 до 200 символов."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const id =
            Date.now().toString() + "-" +
            Math.random().toString(36).slice(2, 10);

        const result = await pool.query(
            `INSERT INTO users
                (id, username, username_lower, password_hash)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username_lower) DO NOTHING
             RETURNING id, username, created_at`,
            [
                id,
                cleanUsername,
                cleanUsername.toLowerCase(),
                passwordHash
            ]
        );

        if (result.rowCount === 0) {
            return res.status(409).json({
                success: false,
                message: "Такой пользователь уже существует."
            });
        }

        const user = result.rows[0];

        console.log("Новый пользователь:", user.username);

        return res.status(201).json({
            success: true,
            message: "Регистрация успешна! 🦁",
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error("Ошибка регистрации:", error);

        return res.status(500).json({
            success: false,
            message: "Ошибка сервера."
        });
    }
});

// ==========================================
// ВХОД
// ==========================================

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Введите имя пользователя и пароль."
            });
        }

        const result = await pool.query(
            `SELECT id, username, password_hash
             FROM users
             WHERE username_lower = $1`,
            [username.trim().toLowerCase()]
        );

        if (result.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: "Неверное имя пользователя или пароль."
            });
        }

        const user = result.rows[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Неверное имя пользователя или пароль."
            });
        }

        console.log("Вход пользователя:", user.username);

        return res.json({
            success: true,
            message: "Вход выполнен! 🦁",
            user: {
                id: user.id,
                username: user.username
            }
        });
    } catch (error) {
        console.error("Ошибка входа:", error);

        return res.status(500).json({
            success: false,
            message: "Ошибка сервера."
        });
    }
});

// ==========================================
// ПОЛУЧЕНИЕ ОБЩИХ СООБЩЕНИЙ
// ==========================================

app.get("/api/messages", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id,
                   username,
                   message_text AS text,
                   created_at AS "createdAt"
            FROM messages
            ORDER BY created_at DESC
            LIMIT 500
        `);

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            messages: result.rows.reverse()
        });
    } catch (error) {
        console.error("Ошибка загрузки сообщений:", error);

        return res.status(500).json({
            success: false,
            message: "Не удалось загрузить сообщения."
        });
    }
});

// ==========================================
// ОТПРАВКА ОБЩЕГО СООБЩЕНИЯ
// ==========================================

app.post("/api/messages", async (req, res) => {
    try {
        const { username, text } = req.body || {};

        if (
            typeof username !== "string" ||
            typeof text !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Укажите имя и текст сообщения."
            });
        }

        const cleanUsername = username.trim();
        const cleanText = text.trim();

        if (
            !cleanUsername ||
            cleanUsername.length > 30
        ) {
            return res.status(400).json({
                success: false,
                message: "Некорректное имя пользователя."
            });
        }

        if (
            !cleanText ||
            cleanText.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Сообщение должно содержать от 1 до 2000 символов."
            });
        }

        const id =
            Date.now().toString() + "-" +
            Math.random().toString(36).slice(2, 10);

        const result = await pool.query(
            `INSERT INTO messages (id, username, message_text)
             VALUES ($1, $2, $3)
             RETURNING id,
                       username,
                       message_text AS text,
                       created_at AS "createdAt"`,
            [id, cleanUsername, cleanText]
        );

        const message = result.rows[0];

        // Храним не более 5000 последних сообщений.
        await pool.query(`
            DELETE FROM messages
            WHERE id IN (
                SELECT id
                FROM messages
                ORDER BY created_at DESC
                OFFSET 5000
            )
        `);

        return res.status(201).json({
            success: true,
            message
        });
    } catch (error) {
        console.error("Ошибка отправки сообщения:", error);

        return res.status(500).json({
            success: false,
            message: "Не удалось сохранить сообщение."
        });
    }
});

// ==========================================
// ОБРАБОТКА ОШИБОК
// ==========================================

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
        return res.status(400).json({
            success: false,
            message: "Некорректный JSON."
        });
    }

    console.error("Ошибка сервера:", err.message);

    res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера."
    });
});

// ==========================================
// ЗАПУСК
// ==========================================

async function startServer() {
    try {
        await initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("");
            console.log("=================================");
            console.log("       LEOMAIL SERVER 🦁");
            console.log("=================================");
            console.log("Порт:", PORT);
            console.log("Сервер запущен!");
            console.log("");
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
