const express = require('express');
const { nanoid } = require("nanoid");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const cors = require('cors');

const app = express();
const port = 3000;

// CORS
app.use(cors({
    origin: "http://localhost:3001",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ============================================
// КОНФИГУРАЦИЯ JWT
// ============================================
const ACCESS_SECRET = "your-access-secret-key";
const REFRESH_SECRET = "your-refresh-secret-key";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";

let refreshTokens = new Set();

// ============================================
// SWAGGER
// ============================================
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Спортивный магазин API',
            version: '1.0.0',
            description: 'API для управления товарами с аутентификацией',
        },
        servers: [{ url: `http://localhost:${port}` }],
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
            }
        },
        security: [{ bearerAuth: [] }]
    },
    apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ============================================
// ХРАНИЛИЩА
// ============================================
let users = [];
let products = [
    { id: "1", title: "Футбольный мяч", category: "Мячи", description: "Профессиональный мяч", price: 2500 },
    { id: "2", title: "Баскетбольный мяч", category: "Мячи", description: "Размер 7", price: 3200 },
    { id: "3", title: "Беговые кроссовки", category: "Обувь", description: "Размер 42", price: 5500 },
    { id: "4", title: "Теннисная ракетка", category: "Ракетки", description: "Профессиональная", price: 8900 },
    { id: "5", title: "Гантели 5 кг", category: "Гантели", description: "Пара", price: 2100 },
    { id: "6", title: "Скакалка", category: "Аксессуары", description: "Профессиональная", price: 450 },
    { id: "7", title: "Коврик для йоги", category: "Аксессуары", description: "Противоскользящий", price: 1200 },
    { id: "8", title: "Боксерские перчатки", category: "Бокс", description: "12 унций", price: 3500 },
    { id: "9", title: "Велосипед", category: "Транспорт", description: "Горный", price: 18500 },
    { id: "10", title: "Защитный шлем", category: "Защита", description: "Велосипедный", price: 2800 }
];

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================
async function hashPassword(password) {
    return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function findUserByEmail(email) {
    return users.find(u => u.email === email);
}

function findUserById(id) {
    return users.find(u => u.id === id);
}

// ============================================
// MIDDLEWARE
// ============================================
function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ error: "Требуется авторизация" });
    }
    
    try {
        const payload = jwt.verify(token, ACCESS_SECRET);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: "Неверный токен" });
    }
}

// ============================================
// ГЕНЕРАЦИЯ ТОКЕНОВ
// ============================================
function generateAccessToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role || "user" },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXPIRES_IN }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role || "user" },
        REFRESH_SECRET,
        { expiresIn: REFRESH_EXPIRES_IN }
    );
}

// ============================================
// МАРШРУТЫ АУТЕНТИФИКАЦИИ
// ============================================

// РЕГИСТРАЦИЯ
app.post("/api/auth/register", async (req, res) => {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
        return res.status(400).json({ error: "Все поля обязательны" });
    }

    if (findUserByEmail(email)) {
        return res.status(400).json({ error: "Email уже существует" });
    }

    const newUser = {
        id: nanoid(),
        email,
        first_name,
        last_name,
        role: "user",
        hashedPassword: await hashPassword(password)
    };

    users.push(newUser);
    
    const { hashedPassword, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
});

// ВХОД
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email и пароль обязательны" });
    }

    const user = findUserByEmail(email);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }

    const isValid = await verifyPassword(password, user.hashedPassword);
    if (!isValid) {
        return res.status(401).json({ error: "Неверный пароль" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    refreshTokens.add(refreshToken);

    res.json({ accessToken, refreshToken });
});

// ОБНОВЛЕНИЕ ТОКЕНОВ
app.post("/api/auth/refresh", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken || !refreshTokens.has(refreshToken)) {
        return res.status(401).json({ error: "Недействительный refresh-токен" });
    }

    try {
        const payload = jwt.verify(refreshToken, REFRESH_SECRET);
        const user = findUserById(payload.sub);
        if (!user) {
            return res.status(401).json({ error: "Пользователь не найден" });
        }

        refreshTokens.delete(refreshToken);
        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);
        refreshTokens.add(newRefreshToken);

        res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
    } catch {
        return res.status(401).json({ error: "Недействительный refresh-токен" });
    }
});

// ПОЛУЧИТЬ ИНФОРМАЦИЮ О СЕБЕ
app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = findUserById(req.user.sub);
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    const { hashedPassword, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

// ============================================
// МАРШРУТЫ ДЛЯ ТОВАРОВ
// ============================================

// ПОЛУЧИТЬ ВСЕ ТОВАРЫ
app.get("/api/products", (req, res) => {
    res.json(products);
});

// ПОЛУЧИТЬ ТОВАР ПО ID
app.get("/api/products/:id", (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
        return res.status(404).json({ error: "Товар не найден" });
    }
    res.json(product);
});

// СОЗДАТЬ ТОВАР
app.post("/api/products", authMiddleware, (req, res) => {
    const { title, category, description, price } = req.body;

    if (!title || !category || !price) {
        return res.status(400).json({ error: "Название, категория и цена обязательны" });
    }

    const newProduct = {
        id: nanoid(),
        title,
        category,
        description: description || "",
        price: Number(price),
        createdBy: req.user.sub,
        createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

// ОБНОВИТЬ ТОВАР
app.put("/api/products/:id", authMiddleware, (req, res) => {
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
        return res.status(404).json({ error: "Товар не найден" });
    }

    const { title, category, description, price } = req.body;
    if (title !== undefined) product.title = title;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    
    res.json(product);
});

// УДАЛИТЬ ТОВАР
app.delete("/api/products/:id", authMiddleware, (req, res) => {
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: "Товар не найден" });
    }
    
    products.splice(index, 1);
    res.status(204).send();
});

// ============================================
// ЗАПУСК
// ============================================
/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - title
 *         - price
 *         - category
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         category:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить все товары
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список товаров
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Товар найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 */

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - category
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Товар создан
 *       401:
 *         description: Не авторизован
 */

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Товар обновлен
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Товар удален
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [user, seller, admin]
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получить всех пользователей (только admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       403:
 *         description: Недостаточно прав
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Получить пользователя по ID (только admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Пользователь найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Пользователь не найден
 */

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Обновить пользователя (только admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, seller, admin]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Пользователь обновлен
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Пользователь не найден
 */

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Заблокировать пользователя (только admin)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Пользователь заблокирован
 *       403:
 *         description: Недостаточно прав
 *       404:
 *         description: Пользователь не найден
 */

app.listen(port, () => {
    console.log(`✅ Сервер запущен на http://localhost:${port}`);
    console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
    console.log(`📦 Товаров в базе: ${products.length}`);
});