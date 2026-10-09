"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(__dirname));

// ==========================================
// ФАЙЛЫ ДАННЫХ
// ==========================================

const usersFile = path.join(__dirname, "users.json");
const messagesFile = path.join(__dirname, "messages.json");

function readJSON(file, fallback = []) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2),
                "utf8"
            );
        }

        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        console.error("Ошибка чтения файла:", file, error);
        return fallback;
    }
}

function writeJSON(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

function loadUsers() {
    return readJSON(usersFile);
}

function saveUsers(users) {
    writeJSON(usersFile, users);
}

function loadMessages() {
    return readJSON(messagesFile);
}

function saveMessages(messages) {
    writeJSON(messagesFile, messages);
}

// ==========================================
// ГЛАВНАЯ СТРАНИЦА
// ==========================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// СТАТУС СЕРВЕРА
// ==========================================

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        message: "Leomail server работает! 🦁"
    });
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

        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
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

        const users = loadUsers();

        const existingUser = users.find(
            user =>
                user.username.toLowerCase() ===
                cleanUsername.toLowerCase()
        );

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Такой пользователь уже существует."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString() + "-" +
                Math.random().toString(36).slice(2, 8),
            username: cleanUsername,
            passwordHash,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        saveUsers(users);

        console.log("Новый пользователь:", cleanUsername);

        return res.status(201).json({
            success: true,
            message: "Регистрация успешна! 🦁",
            user: {
                id: newUser.id,
                username: newUser.username
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

        const users = loadUsers();

        const user = users.find(
            item =>
                item.username.toLowerCase() ===
                username.trim().toLowerCase()
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Неверное имя пользователя или пароль."
            });
        }

        const passwordCorrect = await bcrypt.compare(
            password,
            user.passwordHash
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

app.get("/api/messages", (req, res) => {
    try {
        const messages = loadMessages();

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            messages: messages.slice(-500)
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

app.post("/api/messages", (req, res) => {
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

        if (!cleanUsername || cleanUsername.length > 30) {
            return res.status(400).json({
                success: false,
                message: "Некорректное имя пользователя."
            });
        }

        if (!cleanText || cleanText.length > 2000) {
            return res.status(400).json({
                success: false,
                message: "Сообщение должно содержать от 1 до 2000 символов."
            });
        }

        const messages = loadMessages();

        const message = {
            id: Date.now().toString() + "-" +
                Math.random().toString(36).slice(2, 10),
            username: cleanUsername,
            text: cleanText,
            createdAt: new Date().toISOString()
        };

        messages.push(message);

        if (messages.length > 5000) {
            messages.splice(0, messages.length - 5000);
        }

        saveMessages(messages);

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
// ЗАПУСК СЕРВЕРА
// ==========================================

app.listen(PORT, () => {
    console.log("");
    console.log("=================================");
    console.log("       LEOMAIL SERVER 🦁");
    console.log("=================================");
    console.log("Порт:", PORT);
    console.log("Сервер запущен!");
    console.log("");
});
