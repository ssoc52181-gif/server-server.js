"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 3000;

// ==========================================
// НАСТРОЙКИ
// ==========================================

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "..")
    )
);

// ==========================================
// ФАЙЛ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================

const usersFile = path.join(
    __dirname,
    "users.json"
);

function loadUsers() {
    try {
        if (!fs.existsSync(usersFile)) {
            fs.writeFileSync(
                usersFile,
                "[]",
                "utf8"
            );
        }

        const data = fs.readFileSync(
            usersFile,
            "utf8"
        );

        return JSON.parse(data);

    } catch (error) {
        console.error(
            "Ошибка загрузки пользователей:",
            error
        );

        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(
        usersFile,
        JSON.stringify(users, null, 2),
        "utf8"
    );
}

// ==========================================
// ПРОВЕРКА СЕРВЕРА
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

        const { username, password } = req.body;

        // Проверка имени
        if (
            !username ||
            !username.trim()
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Введите имя пользователя."
            });

        }

        const cleanUsername =
            username.trim();

        // Проверка длины имени
        if (
            cleanUsername.length < 3
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Имя пользователя должно содержать минимум 3 символа."
            });

        }

        if (
            cleanUsername.length > 30
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Имя пользователя слишком длинное."
            });

        }

        // Разрешаем буквы, цифры и _
        if (
            !/^[a-zA-Zа-яА-ЯёЁ0-9_]+$/.test(
                cleanUsername
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Имя может содержать только буквы, цифры и _."
            });

        }

        // Проверка пароля
        if (
            !password ||
            password.length < 6
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Пароль должен содержать минимум 6 символов."
            });

        }

        // Загружаем пользователей
        const users = loadUsers();

        // Проверяем существование
        const existingUser =
            users.find(
                user =>
                    user.username.toLowerCase() ===
                    cleanUsername.toLowerCase()
            );

        if (existingUser) {

            return res.status(409).json({
                success: false,
                message:
                    "Такой пользователь уже существует."
            });

        }

        // Хешируем пароль
        const passwordHash =
            await bcrypt.hash(
                password,
                10
            );

        // Создаём пользователя
        const newUser = {

            id:
                Date.now(),

            username:
                cleanUsername,

            passwordHash:
                passwordHash,

            createdAt:
                Date.now()

        };

        users.push(newUser);

        saveUsers(users);

        console.log(
            `Новый пользователь: ${cleanUsername}`
        );

        return res.status(201).json({

            success: true,

            message:
                "Регистрация успешна! 🦁",

            user: {

                id:
                    newUser.id,

                username:
                    newUser.username

            }

        });

    } catch (error) {

        console.error(
            "Ошибка регистрации:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Ошибка сервера."

        });

    }

});

// ==========================================
// ВХОД
// ==========================================

app.post("/api/login", async (req, res) => {

    try {

        const {
            username,
            password
        } = req.body;

        if (
            !username ||
            !password
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Введите имя пользователя и пароль."

            });

        }

        const users =
            loadUsers();

        const user =
            users.find(
                item =>
                    item.username.toLowerCase() ===
                    username.trim().toLowerCase()
            );

        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Неверное имя пользователя или пароль."

            });

        }

        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.passwordHash
            );

        if (!passwordCorrect) {

            return res.status(401).json({

                success: false,

                message:
                    "Неверное имя пользователя или пароль."

            });

        }

        console.log(
            `Вход пользователя: ${user.username}`
        );

        return res.json({

            success: true,

            message:
                "Вход выполнен! 🦁",

            user: {

                id:
                    user.id,

                username:
                    user.username

            }

        });

    } catch (error) {

        console.error(
            "Ошибка входа:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Ошибка сервера."

        });

    }

});

// ==========================================
// ЗАПУСК
// ==========================================

app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "================================="
        );

        console.log(
            "      LEOMAIL SERVER 🦁"
        );

        console.log(
            "================================="
        );

        console.log("");

        console.log(
            `Сайт: http://localhost:${PORT}`
        );

        console.log(
            `API: http://localhost:${PORT}/api/status`
        );

        console.log("");

    }
);
