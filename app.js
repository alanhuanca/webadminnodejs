const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');
const { body, param, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Configuración de la base de datos
const db = mysql.createConnection({
    host: 'MYSQL8001.site4now.net',
    user: 'a883f1_admweb', // Cambia esto si tu usuario es diferente
    password: 'Pr0yect0s', // Cambia esto si tienes contraseña
    database: 'db_a883f1_admweb'
});

db.connect(err => {
    if (err) {
        throw err;
    }
    console.log('Connected to MySQL Database');
});

// Configuración de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.set('views', __dirname + '/views');
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de sesiones
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Asegúrate de cambiar esto a true si usas HTTPS
}));

// Rutas de autenticación
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const username = req.body.username;
    const password = req.body.password;

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(sql, [username, hashedPassword], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'User registration failed' });
        }
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const username = req.body.username;
    const password = req.body.password;

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], async (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Login failed' });
        }
        if (result.length === 0) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }

        req.session.userId = user.id;
        res.redirect('/display');
    });
});

// Middleware para proteger rutas
function authMiddleware(req, res, next) {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
}

app.get('/dashboard', authMiddleware, (req, res) => {
    res.send('Welcome to your dashboard');
});

// Rutas existentes...

app.get('/', (req, res) => {
    res.render('login');
});

app.post('/upload', upload.single('image'), [
    body('text').notEmpty().withMessage('Text is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const imagePath = req.file ? '/uploads/' + req.file.filename : '';
    const textContent = req.body.text || '';

    const sql = 'INSERT INTO uploads (imagePath, textContent) VALUES (?, ?)';
    db.query(sql, [imagePath, textContent], (err, result) => {
        if (err) {
            throw err;
        }
        res.redirect('/display');
    });
});

app.get('/display', (req, res) => {
    const sql = 'SELECT * FROM uploads';
    db.query(sql, (err, results) => {
        if (err) {
            throw err;
        }
        res.render('display', { data: results });
    });
});

const validateId = [
    param('id').isInt({ gt: 0 }).withMessage('ID must be a positive integer'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

app.get('/upload/:id', validateId, (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM uploads WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            throw err;
        }
        if (result.length > 0) {
            res.json(result[0]);
        } else {
            res.status(404).json({ message: 'Record not found' });
        }
    });
});

app.post('/update', [
    body('id').isInt({ gt: 0 }).withMessage('ID must be a positive integer'),
    body('text').notEmpty().withMessage('Text is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const id = req.body.id;
    const textContent = req.body.text;

    const sql = 'UPDATE uploads SET textContent = ? WHERE id = ?';
    db.query(sql, [textContent, id], (err, result) => {
        if (err) {
            throw err;
        }
        res.json({ message: 'Record updated successfully' });
    });
});

app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
