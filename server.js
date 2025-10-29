// server.js (Versión Final con Canal de Twitch Corregido)

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
// Usamos Pool para gestionar las conexiones a la DB eficientemente
const { Pool } = require('pg'); 
const cors = require('cors'); 
require('dotenv').config(); 


// ====================================================
// 1. INICIALIZACIÓN DE EXPRESS Y MIDDLEWARE
// ====================================================

const app = express(); 

// 1.1. Configuración de CORS
const allowedOrigins = [
    'https://colmena-inteligente.onrender.com', 
    'http://localhost:8080',                   
    'http://127.0.0.1:8080'                    
];

app.use(cors({
    origin: allowedOrigins,
    methods: 'GET,POST',
    credentials: true
}));

app.use(bodyParser.json()); 

// Configuración de archivos estáticos (Busca en la carpeta 'public')
app.use(express.static(path.join(__dirname, 'public'))); 

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

const REQUIRED_ENV = ['DATABASE_URL', 'TWITCH_CHANNEL_NAME'];
REQUIRED_ENV.forEach(key => {
    if (!process.env[key]) {
        console.warn(`⚠️ Advertencia: La variable de entorno ${key} no está definida. Usando valor por defecto si aplica.`);
        // No salimos con error, pero advertimos si falta la variable.
    }
});


// ====================================================
// 2. CONFIGURACIÓN DE LA BASE DE DATOS
// ====================================================

let dbPool; 

async function connectAndInitializeDB() {
    console.log("Intentando conectar a la base de datos...");

    try {
        dbPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        await dbPool.query('SELECT NOW()'); 
        console.log('✅ Conexión a PostgreSQL exitosa.');

        // Crear la tabla 'data' (Corregida: SERIAL PRIMARY KEY)
        const createDataTableQuery = `
            CREATE TABLE IF NOT EXISTS data (
                id SERIAL PRIMARY KEY, 
                weight REAL,
                temperature REAL,
                humidity REAL,
                audio INTEGER, 
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await dbPool.query(createDataTableQuery);

        // Crear la tabla 'thresholds' y poblarla con valores por defecto
        const createThresholdsTableQuery = `
            CREATE TABLE IF NOT EXISTS thresholds (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                value REAL NOT NULL
            );
        `;
        await dbPool.query(createThresholdsTableQuery);

        const defaultThresholds = [
            { name: 'WEIGHT_LOW', value: 15000 },
            { name: 'TEMP_HIGH', value: 36 },
            { name: 'TEMP_LOW', value: 30 },
            { name: 'HUMIDITY_HIGH', value: 70 },
            { name: 'AUDIO_HIGH', value: 3000 }
        ];

        for (const { name, value } of defaultThresholds) {
            const query = `
                INSERT INTO thresholds (name, value)
                VALUES ($1, $2)
                ON CONFLICT (name) DO NOTHING;
            `;
            await dbPool.query(query, [name, value]);
        }
        console.log('✅ Base de datos verificada/inicializada.');


    } catch (error) {
        console.error('❌ Error fatal al conectar o inicializar DB:', error.message);
        process.exit(1); 
    }
}


// ====================================================
// 3. FUNCIONES DE ACCESO A DATOS Y CONFIGURACIÓN
// ====================================================

/**
 * Obtiene el registro más reciente de la tabla 'data'.
 */
async function getLatestData() {
    const query = `
        SELECT weight, temperature, humidity, audio, timestamp 
        FROM data 
        ORDER BY timestamp DESC 
        LIMIT 1;
    `;
    try {
        const result = await dbPool.query(query);
        return result.rows[0] || {};
    } catch (error) {
        console.error('❌ Error al obtener el último dato:', error);
        return {};
    }
}


/**
 * Consulta la DB para obtener la fecha/hora mínima y máxima registradas.
 */
async function getDataLimits() {
    const query = `
        SELECT 
            MIN(timestamp) AS min_date, 
            MAX(timestamp) AS max_date 
        FROM data;
    `;
    try {
        // 🔄 Usamos dbPool para ejecutar la consulta
        const result = await dbPool.query(query);
        // Devuelve { min_date: 'AAAA-MM-DDTHH:mm:ss.sssZ', max_date: 'AAAA-MM-DDTHH:mm:ss.sssZ' }
        return result.rows[0]; 
    } catch (error) {
        console.error('❌ Error al obtener límites de fecha de la DB:', error);
        return { min_date: null, max_date: null };
    }
}

/**
 * Obtiene la configuración de la URL de Twitch para el Iframe.
 * @returns {object} Objeto con la propiedad twitchEmbedUrl.
 */
function getTwitchChannelConfig() {
    // 📢 CRÍTICO: Usamos el nombre de canal proporcionado por el usuario
    const TWITCH_CHANNEL_NAME = process.env.TWITCH_CHANNEL_NAME || 'reservatrefila'; 
    
    // El 'parent' es CRÍTICO para la seguridad de Twitch
    let parentDomains = ['render.com', 'localhost'];
    if (process.env.NODE_ENV !== 'production') {
        // Agregamos puertos comunes para desarrollo local
        parentDomains.push('localhost:8080'); 
        parentDomains.push('127.0.0.1:8080');
        parentDomains.push('127.0.0.1'); // Para compatibilidad sin puerto
        parentDomains.push('localhost');
    }

    const parentList = parentDomains.join('&parent=');

    // Genera la URL de incrustación de Twitch
    const embedUrl = `https://player.twitch.tv/?channel=${TWITCH_CHANNEL_NAME}&parent=${parentList}&muted=true&autoplay=true`;
    return {
        twitchEmbedUrl: embedUrl
    };
}


// ====================================================
// 4. ENDPOINTS (RUTAS API)
// ====================================================

// ENDPOINT PRINCIPAL: Renderiza el dashboard (GET /)
app.get('/', async (req, res) => {
    try {
        // CRÍTICO: Obtener la configuración de video antes de renderizar
        const videoConfig = getTwitchChannelConfig();
        
        // Renderiza 'index.ejs', pasando la variable esperada por la plantilla
        res.render('index', videoConfig); 
    } catch (error) {
        console.error('❌ Error al renderizar la página principal:', error);
        // Fallback en caso de error de renderizado
        res.render('index', { twitchEmbedUrl: null });
    }
});


// Endpoint para recibir los datos del ESP32 (POST /data)
app.post('/data', async (req, res) => {
    const { weight, temperature, humidity, audio } = req.body;

    if (weight === undefined || temperature === undefined || humidity === undefined || audio === undefined) {
        return res.status(400).send('Faltan datos en la solicitud.');
    }

    const query = `
        INSERT INTO data (weight, temperature, humidity, audio) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *;
    `;
    const values = [weight, temperature, humidity, audio];

    try {
        await dbPool.query(query, values);
        res.status(201).send('Datos guardados exitosamente.');
    } catch (error) {
        console.error('❌ Error al guardar datos en DB:', error);
        res.status(500).send('Error interno del servidor al guardar datos.');
    }
});


// Endpoint para obtener los límites de fecha (GET /datelimits)
app.get('/data-limits', async (req, res) => {
    const limits = await getDataLimits();
    // 💡 CRÍTICO: El frontend espera el JSON de los límites
    res.json(limits); 
});


// Endpoint para obtener los últimos datos (GET /latest)
app.get('/latest', async (req, res) => {
    const latestData = await getLatestData();
    res.json(latestData);
});


// Endpoint para obtener los umbrales de alerta (GET /thresholds)
app.get('/thresholds', async (req, res) => {
    try {
        const result = await dbPool.query('SELECT name, value FROM thresholds');
        // Convertir la matriz de filas a un objeto clave-valor
        const thresholds = result.rows.reduce((acc, row) => {
            acc[row.name] = row.value;
            return acc;
        }, {});
        res.json(thresholds);
    } catch (error) {
        console.error('❌ Error al obtener umbrales:', error);
        res.status(500).json({});
    }
});


// Endpoint para enviar los datos históricos para gráficas (GET /history)
app.get('/history', async (req, res) => {
    // Aceptamos los cuatro componentes
    let { startDate, endDate, startTime, endTime } = req.query; 
    
    // 💡 CRÍTICO: Filtramos por rango de DÍAS (timestamp::date) Y por rango de HORAS (timestamp::time)
    let query = `
        SELECT weight, temperature, humidity, audio, timestamp 
        FROM data
        WHERE 
            -- 1. Rango de DÍAS (AAAA-MM-DD)
            timestamp::date >= $1::date AND timestamp::date <= $2::date
            
            -- 2. Rango HORARIO RECURRENTE (HH:mm:ss)
            AND timestamp::time >= $3::time AND timestamp::time <= $4::time

        ORDER BY timestamp ASC
        LIMIT 500;
    `;
    // Los valores son: [startDate, endDate, startTime, endTime]
    let values = [startDate, endDate, startTime, endTime];

    try {
        console.log(`Ejecutando SQL: Histórico de ${startDate} a ${endDate} en rango ${startTime}-${endTime}`); 
        // 🔄 Usamos dbPool
        const result = await dbPool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Error al obtener el histórico con filtros (SQL Falló):', error);
        res.status(500).json([]);
    }
});


// ====================================================
// 5. INICIO DEL SERVIDOR
// ====================================================

const FALLBACK_PORT = 8080;
const PORT = process.env.PORT || FALLBACK_PORT;

(async () => {
    await connectAndInitializeDB();

    app.listen(PORT, () => {
        console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
        if (PORT === FALLBACK_PORT) {
            console.log(`🔗 Dashboard disponible en: http://localhost:${PORT}`);
        }
    });
})();