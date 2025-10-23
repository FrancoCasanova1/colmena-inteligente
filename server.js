// ----------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------

// Endpoint para recibir los datos del ESP32 Heltec (POST)
app.post('/data', async (req, res) => {
    const data = req.body;
    if (data.weight && data.temperature) {
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


// ----------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------

// Render asigna el puerto a través de la variable de entorno PORT
const PORT = process.env.PORT || 8080; 

app.listen(PORT, () => {
    // La conexión a Render es segura, así que el servidor se accede por HTTPS
    console.log(`🐝 Servidor de Colmena Inteligente corriendo en el puerto ${PORT}`);
});