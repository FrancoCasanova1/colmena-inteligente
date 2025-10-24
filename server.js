// server.js (Versión con Twitch Stream Dinámico)

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Client } = require('pg'); 

// ====================================================
// 1. INICIALIZACIÓN DE EXPRESS Y MIDDLEWARE
// ====================================================

const app = express(); 

// Middleware para parsear cuerpos de solicitud JSON (ESP32)
app.use(bodyParser.json()); 
// Servir archivos estáticos (CSS, JS, imágenes) desde 'public'
app.use(express.static(path.join(__dirname, 'public'))); 

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
// La plantilla del dashboard (index.ejs) debe estar en el directorio 'views'
app.set('views', path.join(__dirname, 'views')); 

// Constante del Dominio de Render para el iframe de Twitch
const RENDER_DOMAIN = 'colmena-inteligente.onrender.com';

// ====================================================
// 2. CONFIGURACIÓN E INICIALIZACIÓN DE POSTGRESQL
// ====================================================

const dbClient = new Client({
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

// Función para conectar y crear tablas
async function connectAndInitializeDB() {
    try {
        await dbClient.connect();
        console.log('✅ Conexión a PostgreSQL establecida.');

        // 1. Crear la tabla 'data' (Si no existe)
        const createDataTableQuery = `
            CREATE TABLE IF NOT EXISTS data (
                id SERIAL PRIMARY KEY,
                weight REAL,
                temperature REAL,
                humidity REAL,
                audio INTEGER, 
                -- cam_url se ELIMINARÁ de aquí tras esta implementación
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbClient.query(createDataTableQuery);
        console.log('✅ Tabla de datos verificada/creada.');

        // 2. Crear la tabla 'settings' para la configuración del stream
        const createSettingsTableQuery = `
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `;
        await dbClient.query(createSettingsTableQuery);
        console.log('✅ Tabla de configuración (settings) verificada/creada.');

        // 3. MIGRACIÓN: Añadir la columna 'audio' si falta
        const addAudioColumnQuery = `
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM information_schema.columns 
                    WHERE table_name='data' AND column_name='audio'
                ) THEN
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
        process.exit(1); 
    }
}

// Ejecutar la conexión y la inicialización de la tabla
connectAndInitializeDB();

// ====================================================
// 3. FUNCIONES DE BASE DE DATOS Y LECTURA DE STREAM
// ====================================================

// Función para guardar los datos recibidos del ESP32 (cam_url ya no se usa aquí)
async function saveData(data) {
    const { weight, temperature, humidity, audio } = data; 
    
    // NOTA: Se ha eliminado 'cam_url' de esta inserción
    const query = `
        INSERT INTO data (weight, temperature, humidity, audio)
        VALUES ($1, $2, $3, $4);
    `;
    const values = [weight, temperature, humidity, audio]; 
    
    try {
        await dbClient.query(query, values);
        console.log(`[${new Date().toLocaleTimeString()}] Datos guardados: Peso=${weight}g, Temp=${temperature}°C.`);
    } catch (error) {
        console.error('❌ Error al guardar datos en PostgreSQL:', error);
    }
}

/**
 * Función para obtener el nombre del canal de Twitch desde la tabla settings.
 */
async function getTwitchChannelConfig() {
    try {
        // Consulta la tabla 'settings' por la clave 'twitch_channel'
        const query = "SELECT value FROM settings WHERE key = 'twitch_channel';";
        const result = await dbClient.query(query);
        
        const channelName = (result.rows.length > 0 && result.rows[0].value)
            ? result.rows[0].value
            : 'twitch_canal_por_defecto'; // Canal de respaldo si no se encuentra
        
        return {
            channel: channelName,
            parent: RENDER_DOMAIN
        };
    } catch (error) {
        console.error('❌ Error al obtener la configuración de Twitch:', error);
        return {
            channel: 'error_al_cargar', 
            parent: RENDER_DOMAIN
        };
    }
}

// Función para obtener el último registro de la base de datos (cam_url eliminado de la SELECT)
async function getLatestData() {
    const query = `
        SELECT weight, temperature, humidity, audio, timestamp
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
        return result.rows.reverse(); 
    } catch (error) {
        console.error('❌ Error al obtener el histórico (SQL Falló):', error);
        return []; 
    }
}

// ====================================================
// 4. ENDPOINTS (Rutas del Servidor)
// ====================================================

// Endpoint principal (Home Page) - AHORA USA EJS
app.get('/', async (req, res) => {
    try {
        // Obtenemos la configuración del stream de la base de datos
        const videoConfig = await getTwitchChannelConfig();

        // Puedes combinar esto con los últimos datos si los necesitas en la página inicial
        // const latestData = await getLatestData(); 
        
        // Renderiza index.ejs y pasa las variables de configuración
        res.render('index', videoConfig);
    } catch (error) {
        console.error('❌ Error al servir el dashboard:', error);
        res.status(500).send('Error interno del servidor.');
    }
});


// Endpoint para recibir los datos del ESP32 Heltec (POST)
app.post('/data', async (req, res) => {
    const data = req.body;
    
    if (data.weight != null && data.temperature != null) {
        // NOTA: El ESP32 ya no necesita enviar cam_url
        await saveData(data); 
        res.status(200).send({ status: 'success' });
    } else {
        res.status(400).send({ status: 'error', message: 'Faltan datos requeridos.' });
    }
});

// Endpoint para enviar los últimos datos al dashboard (GET)
app.get('/latest', async (req, res) => {
    // NOTA: Este endpoint ya no devuelve cam_url. Si tu frontend lo usa, tendrás que actualizarlo.
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

const FALLBACK_PORT = 8080; 
const SERVER_PORT = process.env.PORT || FALLBACK_PORT;

app.listen(SERVER_PORT, () => {
    console.log(`🐝 Servidor de Colmena Inteligente escuchando en el puerto ${SERVER_PORT}`);
});