const express = require('express');
const { nanoid } = require("nanoid");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
const port = 3000;

// ============================================
// КОНФИГУРАЦИЯ JWT
// ============================================

const ACCESS_SECRET = "your-access-secret-key-change-in-production";
const REFRESH_SECRET = "your-refresh-secret-key-change-in-production";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

// Хранилище активных refresh-токенов
let refreshTokens = new Set();

// ============================================
// КОНФИГУРАЦИЯ SWAGGER
// ============================================

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API для аутентификации и управления товарами',
            version: '1.0.0',
            description: 'Серверное приложение с JWT-аутентификацией, refresh-токенами и CRUD операциями для товаров',
        },
        servers: [
            {
                url: `http://localhost:${port}`,
                description: 'Локальный сервер',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        security: [{
            bearerAuth: []
        }]
    },
    apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ============================================
// МИДЛВЭРЫ
// ============================================

app.use(express.json());

app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] [${req.method}] ${res.statusCode} ${req.path}`);
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            console.log('Body:', req.body);
        }
    });
    next();
});

// ============================================
// MIDDLEWARE ДЛЯ АУТЕНТИФИКАЦИИ ACCESS-ТОКЕНА
// ============================================

function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            error: "Отсутствует или неверный формат Authorization header. Ожидается: Bearer <token>"
        });
    }
    
    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Токен истек" });
        }
        return res.status(401).json({ error: "Неверный токен" });
    }
}

// ============================================
// ХРАНИЛИЩА ДАННЫХ
// ============================================

let users = [];
let products = [];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function findUserByEmailOr404(email, res) {
    const user = users.find(u => u.email === email);
    if (!user) {
        res.status(404).json({ error: "Пользователь не найден" });
        return null;
    }
    return user;
}

function findUserById(userId) {
    return users.find(u => u.id === userId);
}

function findProductByIdOr404(productId, res) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        res.status(404).json({ error: "Товар не найден" });
        return null;
    }
    return product;
}

async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}

// ============================================
// ФУНКЦИИ ГЕНЕРАЦИИ ТОКЕНОВ
// ============================================

function generateAccessToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name
        },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email
        },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );
}

// ============================================
// КОРНЕВОЙ МАРШРУТ
// ============================================

app.get("/", (req, res) => {
    res.json({
        name: "API для аутентификации и управления товарами",
        version: "2.0.0",
        documentation: "http://localhost:3000/api-docs",
        endpoints: {
            auth: {
                register: "POST /api/auth/register",
                login: "POST /api/auth/login (возвращает access + refresh токены)",
                refresh: "POST /api/auth/refresh (обновление пары токенов)",
                me: "GET /api/auth/me (требует access токен)"
            },
            products: {
                create: "POST /api/products (требует access токен)",
                getAll: "GET /api/products",
                getOne: "GET /api/products/:id",
                update: "PUT /api/products/:id (требует access токен)",
                delete: "DELETE /api/products/:id (требует access токен)"
            }
        }
    });
});

// ============================================
// МАРШРУТЫ АУТЕНТИФИКАЦИИ
// ============================================

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация нового пользователя
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - first_name
 *               - last_name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
 *       400:
 *         description: Некорректные данные
 */
app.post("/api/auth/register", async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ 
            error: "Все поля обязательны: email, password, first_name, last_name" 
        });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: "Пользователь с таким email уже существует" });
    }

    const newUser = {
        id: nanoid(),
        email,
        first_name,
        last_name,
        hashedPassword: await hashPassword(password)
    };

    users.push(newUser);
    
    const { hashedPassword, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему (возвращает access + refresh токены)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Неверный пароль
 *       404:
 *         description: Пользователь не найден
 */
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "email и password обязательны" });
    }

    const user = findUserByEmailOr404(email, res);
    if (!user) return;

    const isValid = await verifyPassword(password, user.hashedPassword);
    
    if (!isValid) {
        return res.status(401).json({ error: "Неверный пароль" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    refreshTokens.add(refreshToken);

    res.json({ 
        accessToken,
        refreshToken
    });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление пары токенов (refresh-токен)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Новая пара токенов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *       401:
 *         description: Недействительный refresh-токен
 */
app.post("/api/auth/refresh", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken обязателен" });
    }

    if (!refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: "Недействительный refresh-токен" });
    }

    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = findUserById(payload.sub);

        if (!user) {
            return res.status(401).json({ error: "Пользователь не найден" });
        }

        // Ротация refresh-токена
        refreshTokens.delete(refreshToken);
        
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        
        refreshTokens.add(newRefreshToken);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (err) {
        return res.status(401).json({ error: "Недействительный или истекший refresh-токен" });
    }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить информацию о текущем пользователе
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о пользователе
 *       401:
 *         description: Не авторизован
 */
app.get("/api/auth/me", authMiddleware, (req, res) => {
    const userId = req.user.sub;
    const user = findUserById(userId);
    
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    
    res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
    });
});

// ============================================
// МАРШРУТЫ ДЛЯ ТОВАРОВ
// ============================================

app.post("/api/products", authMiddleware, (req, res) => {
    const { title, category, description, price } = req.body;

    if (!title || !category || !description || price === undefined) {
        return res.status(400).json({ 
            error: "Все поля обязательны: title, category, description, price" 
        });
    }

    const newProduct = {
        id: nanoid(),
        title,
        category,
        description,
        price: Number(price),
        createdBy: req.user.sub,
        createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

app.get("/api/products", (req, res) => {
    res.json(products);
});

app.get("/api/products/:id", (req, res) => {
    const product = findProductByIdOr404(req.params.id, res);
    if (product) {
        res.json(product);
    }
});

app.put("/api/products/:id", authMiddleware, (req, res) => {
    const product = findProductByIdOr404(req.params.id, res);
    if (!product) return;

    const { title, category, description, price } = req.body;

    if (title !== undefined) product.title = title;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    
    product.updatedBy = req.user.sub;
    product.updatedAt = new Date().toISOString();

    res.json(product);
});

app.delete("/api/products/:id", authMiddleware, (req, res) => {
    const productIndex = products.findIndex(p => p.id === req.params.id);
    
    if (productIndex === -1) {
        return res.status(404).json({ error: "Товар не найден" });
    }

    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);
    
    res.json({ 
        message: "Товар успешно удален",
        deletedProduct
    });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

app.listen(port, () => {
    console.log(`✅ Сервер запущен на http://localhost:${port}`);
    console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
    console.log(`🔐 ACCESS_SECRET: ${ACCESS_SECRET}`);
    console.log(`🔐 REFRESH_SECRET: ${REFRESH_SECRET}`);
    console.log(`⏱️  Access токен живёт: ${ACCESS_EXPIRES_IN}`);
    console.log(`⏱️  Refresh токен живёт: ${REFRESH_EXPIRES_IN}`);
    console.log(`\n📋 Доступные эндпоинты:`);
    console.log(`   POST   /api/auth/register  - регистрация`);
    console.log(`   POST   /api/auth/login     - вход (access + refresh)`);
    console.log(`   POST   /api/auth/refresh   - обновление пары токенов`);
    console.log(`   GET    /api/auth/me        - текущий пользователь (🔒)`);
    console.log(`   POST   /api/products       - создать товар (🔒)`);
    console.log(`   GET    /api/products       - список товаров`);
    console.log(`   GET    /api/products/:id   - товар по ID`);
    console.log(`   PUT    /api/products/:id   - обновить товар (🔒)`);
    console.log(`   DELETE /api/products/:id   - удалить товар (🔒)`);
    console.log(`\n🔒 - защищенный маршрут (требуется Bearer <accessToken>)`);
});