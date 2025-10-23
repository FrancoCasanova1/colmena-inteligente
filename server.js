// server.js COMPLETO Y OPTIMIZADO
// URL del Servicio: https://colmena-inteligente.onrender.com

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Client } = require('pg'); // Cliente de PostgreSQL

// ====================================================
// 1. INICIALIZACIÓN DE EXPRESS Y MIDDLEWARE
// ====================================================

const app = express(); // Inicializa la aplicación Express

// Middleware para parsear cuerpos de solicitud JSON (necesario para el ESP32)
app.use(bodyParser.json()); 
// Servir archivos estáticos (HTML, CSS, JS del dashboard) desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public'))); 

// ====================================================
// 2. CONFIGURACIÓN E INICIALIZACIÓN DE POSTGRESQL
// ====================================================

// Render inyecta la URL de conexión a la base de datos a través de esta variable de entorno
const dbClient = new Client({
    connectionString: process.env.DATABASE_URL, 
    // Configuración obligatoria para la conexión SSL a Render.
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
                audio INTEGER, 
                cam_url TEXT,
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbClient.query(createTableQuery);
        console.log('✅ Tabla de datos verificada/creada.');

    } catch (err) {
        console.error('❌ Error fatal al conectar o inicializar DB:', err.stack);
        // Terminar el proceso si no se puede conectar a la DB
        process.exit(1); 
    }
}

// Ejecutar la conexión y la inicialización de la tabla
// Asegúrate de que esta función esté DENTRO de server.js y que 'dbClient' esté definido globalmente.
async function connectAndInitializeDB() {
    try {
        await dbClient.connect();
        console.log('✅ Conexión a PostgreSQL establecida.');

        // 1. Crear la tabla 'data' (Si no existe)
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS data (
                id SERIAL PRIMARY KEY,
                weight REAL,
                temperature REAL,
                humidity REAL,
                audio INTEGER, 
                cam_url TEXT,
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbClient.query(createTableQuery);
        console.log('✅ Tabla de datos verificada/creada.');

        // 2. MIGRACIÓN: Añadir la columna 'audio' si falta (soluciona el error 42703)
        // Usamos un bloque DO $$ para ejecutar lógica condicional en SQL.
        const addAudioColumnQuery = `
            DO $$ 
            BEGIN
                -- Verifica si la columna 'audio' NO existe en la tabla 'data'
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='data' AND column_name='audio'
                ) THEN
                    -- Si no existe, la añade
                    ALTER TABLE data ADD COLUMN audio INTEGER;
                    RAISE NOTICE 'Columna "audio" añadida a la tabla "data".';
                END IF;
            END
            $$;
        `;
        await dbClient.query(addAudioColumnQuery); 
        console.log('✅ Migración de columna "audio" comprobada.');

    } catch (err) {
        console.error('❌ Error fatal al conectar o inicializar DB:', err.stack);
        // Terminar el proceso si no se puede conectar a la DB
        process.exit(1); 
    }
}

// Función para obtener el último registro de la base de datos
async function getLatestData() {
    const query = `
        SELECT weight, temperature, humidity, audio, cam_url, timestamp
        FROM data
        ORDER BY id DESC
        LIMIT 1;
    `;
    
    try {
        const result = await dbClient.query(query);
        // Retornar el registro más reciente, o un objeto vacío para el frontend
        return result.rows[0] || {}; 
    } catch (error) {
        console.error('❌ Error al obtener los últimos datos:', error);
        return {};
    }
}

// Función para obtener los últimos 24 registros para la gráfica de historial
async function getHistory() {
    const query = `
        SELECT weight, temperature, humidity, timestamp 
        FROM data
        ORDER BY id DESC
        LIMIT 24;
    `;
    
    try {
        const result = await dbClient.query(query);
        // Invertimos los datos para que el más antiguo quede primero (útil para series de tiempo)
        return result.rows.reverse(); 
    } catch (error) {
        // El error 500 se previene devolviendo un array vacío []
        console.error('❌ Error al obtener el histórico (SQL Falló):', error);
        return []; 
    }
}

// ====================================================
// 4. ENDPOINTS (Rutas del Servidor)
// ====================================================

// Endpoint principal (Home Page)
app.get('/', (req, res) => {
    // Sirve el dashboard principal
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Endpoint para recibir los datos del ESP32 Heltec (POST)
app.post('/data', async (req, res) => {
    const data = req.body;
    
    // Verificación de datos esenciales (Peso y Temperatura son obligatorios)
    if (data.weight != null && data.temperature != null) {
        await saveData(data);
        res.status(200).send({ status: 'success' });
    } else {
        // Devuelve un error 400 si faltan datos
        res.status(400).send({ status: 'error', message: 'Faltan datos requeridos (weight o temperature).' });
    }
});

// Endpoint para enviar los últimos datos al dashboard (GET)
app.get('/latest', async (req, res) => {
    const latestData = await getLatestData();
    res.json(latestData);
});

// Endpoint para enviar los datos históricos para gráficas (GET)
app.get('/history', async (req, res) => {
    const historyData = await getHistory();
    res.json(historyData);
});


// ====================================================
// 5. INICIO DEL SERVIDOR
// ====================================================

// Render asigna el puerto a través de la variable de entorno PORT (ej. 10000)
const PORT = process.env.PORT || 8080; 

app.listen(PORT, () => {
    // Este mensaje aparecerá en los logs de Render
    console.log(`🐝 Servidor de Colmena Inteligente escuchando en el puerto ${PORT}`);
});