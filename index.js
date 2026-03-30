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

const JWT_SECRET = "your-super-secret-jwt-key-change-this-in-production"; // Секретный ключ для подписи токенов
const ACCESS_EXPIRES_IN = "15m"; // Время жизни access-токена (15 минут)

// ============================================
// КОНФИГУРАЦИЯ SWAGGER
// ============================================

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API для аутентификации и управления товарами',
            version: '1.0.0',
            description: 'Серверное приложение с JWT-аутентификацией и CRUD операциями для товаров',
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

// Логирующий мидлвэр
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
// MIDDLEWARE ДЛЯ АУТЕНТИФИКАЦИИ JWT
// ============================================

/**
 * Middleware для проверки JWT токена
 * Извлекает токен из заголовка Authorization и верифицирует его
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization || "";
    
    // Ожидаем формат: Bearer <token>
    const [scheme, token] = header.split(" ");
    
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            error: "Отсутствует или неверный формат Authorization header. Ожидается: Bearer <token>"
        });
    }
    
    try {
        // Верифицируем токен с секретным ключом
        const payload = jwt.verify(token, JWT_SECRET);
        // Сохраняем данные пользователя из токена в объект запроса
        req.user = payload; // { sub, email, first_name, last_name, iat, exp }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: "Токен истек" });
        }
        return res.status(401).json({ error: "Неверный или просроченный токен" });
    }
}

// ============================================
// ХРАНИЛИЩА ДАННЫХ
// ============================================

let users = [];
let products = [];


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
    const rounds = 10;
    return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, passwordHash) {
    return bcrypt.compare(password, passwordHash);
}

// ============================================
// КОРНЕВОЙ МАРШРУТ
// ============================================

app.get("/", (req, res) => {
    res.json({
        name: "API для аутентификации и управления товарами",
        version: "1.0.0",
        documentation: "http://localhost:3000/api-docs",
        endpoints: {
            auth: {
                register: "POST /api/auth/register",
                login: "POST /api/auth/login",
                me: "GET /api/auth/me (требует JWT)"
            },
            products: {
                create: "POST /api/products (требует JWT)",
                getAll: "GET /api/products",
                getOne: "GET /api/products/:id",
                update: "PUT /api/products/:id (требует JWT)",
                delete: "DELETE /api/products/:id (требует JWT)"
            }
        }
    });
});


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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: mySecurePassword123
 *               first_name:
 *                 type: string
 *                 example: Иван
 *               last_name:
 *                 type: string
 *                 example: Петров
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
        email: email,
        first_name: first_name,
        last_name: last_name,
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
 *     summary: Вход в систему (возвращает JWT токен)
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
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: mySecurePassword123
 *     responses:
 *       200:
 *         description: Успешный вход, возвращает accessToken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 user:
 *                   type: object
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

    const isAuthenticated = await verifyPassword(password, user.hashedPassword);
    
    if (isAuthenticated) {
        // Создаем JWT токен
        const accessToken = jwt.sign(
            {
                sub: user.id,           // subject - идентификатор пользователя
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
            },
            JWT_SECRET,
            {
                expiresIn: ACCESS_EXPIRES_IN
            }
        );
        
        res.status(200).json({ 
            message: "Вход выполнен успешно",
            accessToken: accessToken,
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name
            }
        });
    } else {
        res.status(401).json({ error: "Неверный пароль" });
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
 *         description: Не авторизован (отсутствует или неверный токен)
 */
app.get("/api/auth/me", authMiddleware, (req, res) => {
    // Данные пользователя уже в req.user из middleware
    const userId = req.user.sub;
    const user = findUserById(userId);
    
    if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
    }
    
    // Возвращаем информацию о пользователе без пароля
    res.json({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
    });
});

// ============================================
// МАРШРУТЫ ДЛЯ РАБОТЫ С ТОВАРАМИ
// ============================================

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать новый товар (требует JWT)
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
 *               - description
 *               - price
 *             properties:
 *               title:
 *                 type: string
 *                 example: Ноутбук
 *               category:
 *                 type: string
 *                 example: Электроника
 *               description:
 *                 type: string
 *                 example: Мощный ноутбук для работы и игр
 *               price:
 *                 type: number
 *                 example: 75000
 *     responses:
 *       201:
 *         description: Товар успешно создан
 *       401:
 *         description: Не авторизован
 */
app.post("/api/products", authMiddleware, (req, res) => {
    const { title, category, description, price } = req.body;

    if (!title || !category || !description || price === undefined) {
        return res.status(400).json({ 
            error: "Все поля обязательны: title, category, description, price" 
        });
    }

    const newProduct = {
        id: nanoid(),
        title: title,
        category: category,
        description: description,
        price: Number(price),
        createdBy: req.user.sub, // Кто создал товар
        createdAt: new Date().toISOString()
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров (доступно всем)
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Список товаров
 */
app.get("/api/products", (req, res) => {
    res.status(200).json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID (доступно всем)
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
 *       404:
 *         description: Товар не найден
 */
app.get("/api/products/:id", (req, res) => {
    const productId = req.params.id;
    const product = findProductByIdOr404(productId, res);
    
    if (product) {
        res.status(200).json(product);
    }
});

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Обновить товар (требует JWT)
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
app.put("/api/products/:id", authMiddleware, (req, res) => {
    const productId = req.params.id;
    const product = findProductByIdOr404(productId, res);
    
    if (!product) return;

    const { title, category, description, price } = req.body;

    if (title !== undefined) product.title = title;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    
    product.updatedBy = req.user.sub;
    product.updatedAt = new Date().toISOString();

    res.status(200).json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар (требует JWT)
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
 *       200:
 *         description: Товар удален
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Товар не найден
 */
app.delete("/api/products/:id", authMiddleware, (req, res) => {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
        return res.status(404).json({ error: "Товар не найден" });
    }

    const deletedProduct = products[productIndex];
    products.splice(productIndex, 1);
    
    res.status(200).json({ 
        message: "Товар успешно удален",
        deletedProduct: deletedProduct 
    });
});



app.listen(port, () => {
    console.log(`✅ Сервер запущен на http://localhost:${port}`);
    console.log(`📚 Swagger UI доступен по адресу http://localhost:${port}/api-docs`);
    console.log(`🏠 Главная страница: http://localhost:${port}`);
    console.log(`🔐 JWT секрет: ${JWT_SECRET}`);
    console.log(`⏱️  Время жизни токена: ${ACCESS_EXPIRES_IN}`);
    console.log(`\n📋 Доступные эндпоинты:`);
    console.log(`   🔓 POST   /api/auth/register  - регистрация`);
    console.log(`   🔓 POST   /api/auth/login     - вход (получение JWT)`);
    console.log(`   🔒 GET    /api/auth/me        - текущий пользователь (требует JWT)`);
    console.log(`   🔒 POST   /api/products       - создать товар (требует JWT)`);
    console.log(`   🔓 GET    /api/products       - список товаров`);
    console.log(`   🔓 GET    /api/products/:id   - товар по ID`);
    console.log(`   🔒 PUT    /api/products/:id   - обновить товар (требует JWT)`);
    console.log(`   🔒 DELETE /api/products/:id   - удалить товар (требует JWT)`);
    console.log(`\n🔒 - защищенный маршрут (требуется JWT токен в заголовке Authorization: Bearer <token>)`);
});