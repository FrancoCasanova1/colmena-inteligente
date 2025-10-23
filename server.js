// server.js COMPLETO Y CORREGIDO PARA RENDER (PostgreSQL)

// ----------------------------------------------------
// 1. DEPENDENCIAS E INICIALIZACIÓN
// ----------------------------------------------------
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Client } = require('pg');

// ************* ¡ESTO FALTABA! *************
const app = express(); 
// *****************************************

// Middleware
app.use(bodyParser.json());
// Servir archivos estáticos desde la carpeta 'public' (tu dashboard HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));


// ----------------------------------------------------
// 2. CONEXIÓN A POSTGRESQL (RENDER)
// ----------------------------------------------------

const dbClient = new Client({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// Función para conectar y crear la tabla si no existe
async function connectAndInitializeDB() {
    try {
        await dbClient.connect();
        console.log('✅ Conexión a PostgreSQL establecida.');

        // Consulta SQL para crear la tabla 'data' (si no existe)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS data (
                id SERIAL PRIMARY KEY,
                weight REAL,
                temperature REAL,
                humidity REAL,
                cam_url TEXT,
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbClient.query(createTableQuery);
        console.log('✅ Tabla de datos verificada/creada.');

    } catch (err) {
        console.error('❌ Error fatal al conectar o inicializar DB:', err.stack);
        process.exit(1); 
    }
}

// Ejecutar la conexión y la inicialización de la tabla
connectAndInitializeDB();


// ----------------------------------------------------
// 3. FUNCIONES DE BASE DE DATOS (CRUD)
// ******* ESTO TAMBIÉN FALTABA Y ES REQUERIDO POR LAS RUTAS *******
// ----------------------------------------------------

// Función para guardar los datos recibidos del ESP32
async function saveData(data) {
    const { weight, temperature, humidity, cam_url } = data;
    const query = `
        INSERT INTO data (weight, temperature, humidity, cam_url)
        VALUES ($1, $2, $3, $4);
    `;
    const values = [weight, temperature, humidity, cam_url];
    try {
        await dbClient.query(query, values);
        console.log(`[${new Date().toLocaleTimeString()}] Datos guardados: ${weight} kg.`);
    } catch (error) {
        console.error('❌ Error al guardar datos en PostgreSQL:', error);
    }
}

// Función para obtener el último registro
async function getLatestData() {
    const query = `
        SELECT weight, temperature, humidity, cam_url, timestamp
        FROM data
        ORDER BY id DESC
        LIMIT 1;
    `;
    try {
        const result = await dbClient.query(query);
        return result.rows[0] || {}; 
    } catch (error) {
        console.error('❌ Error al obtener los últimos datos:', error);
        return {};
    }
}

// Función para obtener datos históricos
// Este es el código JavaScript en tu archivo dentro de la carpeta 'public'
async function fetchHistoryData() {
    try {
        const url = 'https://colmena-inteligente.onrender.com/history';
        const response = await fetch(url);
        const data = await response.json(); // Data será un array: [] o [{...}, {...}]

        // *****************************************************************
        // 1. VERIFICACIÓN CRÍTICA: Manejo del array vacío
        // *****************************************************************
        if (data.length === 0) {
            console.log("Historial vacío. Mostrando mensaje al usuario.");
            
            // Reemplaza el área de la gráfica con un mensaje simple
            document.getElementById('chart-container').innerHTML = 
                '<p class="text-center text-muted mt-5">Aún no hay suficientes datos históricos. El ESP32 enviará el primer registro en 5 minutos.</p>'; 
            
            return; // Detiene la ejecución para que no intente dibujar la gráfica
        }
        
        // 2. Si hay datos, procede a dibujar la gráfica
        drawChart(data); 

    } catch (error) {
        console.error('Error al cargar datos históricos:', error);
        // Si la conexión falla o hay otro error, muestra un mensaje de fallo
        document.getElementById('chart-container').innerHTML = 
            '<p class="text-center text-danger mt-5">Error: No se pudo conectar al servidor para obtener el historial.</p>';
    }
}

// ----------------------------------------------------
// 4. ENDPOINTS
// ----------------------------------------------------

// Endpoint para recibir los datos del ESP32 Heltec (POST)
app.post('/data', async (req, res) => {
    const data = req.body;
    // La comprobación de '!= null' es más segura que solo 'if (data.weight)'
    if (data.weight != null && data.temperature != null) { 
        await saveData(data);
        res.status(200).send({ status: 'success' });
    } else {
        res.status(400).send({ status: 'error', message: 'Faltan datos requeridos.' });
    }
});

// Endpoint para enviar los últimos datos al dashboard (GET)
app.get('/latest', async (req, res) => {
    const latestData = await getLatestData();
    res.json(latestData);
});

// Endpoint para enviar los datos históricos (GET)
app.get('/history', async (req, res) => {
    const historyData = await getHistory();
    res.json(historyData);
});

// Endpoint de prueba/Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// ----------------------------------------------------
// 5. INICIO DEL SERVIDOR
// ----------------------------------------------------

const PORT = process.env.PORT || 8080; 

app.listen(PORT, () => {
    console.log(`🐝 Servidor de Colmena Inteligente corriendo en el puerto ${PORT}`);
});