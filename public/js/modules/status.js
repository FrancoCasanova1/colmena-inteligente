// public/js/modules/status.js

// =======================================================
// UMBRALES DE ALERTA (Ajustables según necesidad)
// =======================================================
const THRESHOLDS = {
    // Temperaturas ideales para la cría de abejas
    TEMP_MIN_CRITICAL: 30, // Si baja de esto (noche fría o enfermedad)
    TEMP_MAX_CRITICAL: 38, // Si sube de esto (ola de calor, poca ventilación)
    TEMP_WARNING_LOW: 33,
    TEMP_WARNING_HIGH: 36,

    // Humedad
    HUM_MAX_CRITICAL: 85,
    HUM_WARNING_HIGH: 75,
    HUM_MIN_CRITICAL: 40,
    HUM_WARNING_LOW: 50,

    // Peso (pérdida o ganancia repentina, valores hipotéticos)
    WEIGHT_DRIFT_CRITICAL: 1000, // Cambio de 1kg
    WEIGHT_DRIFT_WARNING: 500,   // Cambio de 500g

    // Ruido (valor máximo del sensor, ajustado a rangos típicos)
    AUDIO_MAX_CRITICAL: 3000,
    AUDIO_WARNING_HIGH: 2000,
};

// =======================================================
// FUNCIÓN PRINCIPAL DE CHEQUEO DE ESTADO
// =======================================================

/**
 * Verifica el estado actual de la colmena en base a los últimos datos.
 * @param {object} data - El último registro de la API (/latest).
 * @param {object} error - Objeto de error si la API falló.
 */
export function checkHiveStatus(data, error = null) {
    let currentStatus = 'status-ok';
    let summaryText = 'Colmena OK: Los parámetros están en el rango óptimo.';
    let alertMessages = [];
    
    const alertListEl = document.getElementById('alert-list');
    const summaryEl = document.querySelector('.alert-summary');
    const summaryHeaderEl = document.getElementById('general-status-display');
    const alertCountSummaryEl = document.getElementById('alert-count-summary'); // Nuevo ID

    // =======================================================
    // 1. MANEJO DE ERRORES DE CONEXIÓN
    // =======================================================
    if (error || !data) {
        currentStatus = 'status-danger';
        summaryText = 'ERROR: No se pueden obtener datos del servidor.';
        alertMessages.push({
            severity: 'status-danger',
            message: `Fallo de conexión o API. (${error ? error.message : 'Sin datos'})`
        });
        // Si hay error o no hay datos, limpiamos el contador y la lista.
        updateAlertVisuals(currentStatus, summaryText, alertMessages, summaryEl, alertListEl, summaryHeaderEl, alertCountSummaryEl);
        return;
    }

    // =======================================================
    // 2. CHEQUEO DE PARÁMETROS DE DATOS
    // =======================================================

    // A. Temperatura
    if (data.temperature > THRESHOLDS.TEMP_MAX_CRITICAL || data.temperature < THRESHOLDS.TEMP_MIN_CRITICAL) {
        currentStatus = 'status-danger';
        alertMessages.push({
            severity: 'status-danger',
            message: `Temperatura Crítica: ${data.temperature.toFixed(1)}°C. Requiere atención urgente.`
        });
    } else if (data.temperature > THRESHOLDS.TEMP_WARNING_HIGH || data.temperature < THRESHOLDS.TEMP_WARNING_LOW) {
        if (currentStatus !== 'status-danger') currentStatus = 'status-warning';
        alertMessages.push({
            severity: 'status-warning',
            message: `Temperatura Elevada/Baja: ${data.temperature.toFixed(1)}°C. Revisar ventilación o aislamiento.`
        });
    }

    // B. Humedad
    if (data.humidity > THRESHOLDS.HUM_MAX_CRITICAL) {
        if (currentStatus === 'status-ok') currentStatus = 'status-danger';
        alertMessages.push({
            severity: 'status-danger',
            message: `Humedad Crítica: ${data.humidity.toFixed(0)}%. Riesgo de enfermedades fúngicas.`
        });
    } else if (data.humidity > THRESHOLDS.HUM_WARNING_HIGH) {
        if (currentStatus === 'status-ok') currentStatus = 'status-warning';
        alertMessages.push({
            severity: 'status-warning',
            message: `Humedad Alta: ${data.humidity.toFixed(0)}%. Mejorar ventilación.`
        });
    }
    
    // C. Ruido
    if (data.audio > THRESHOLDS.AUDIO_MAX_CRITICAL) {
        if (currentStatus === 'status-ok') currentStatus = 'status-danger';
        alertMessages.push({
            severity: 'status-danger',
            message: `Ruido Extremo: Nivel ${data.audio}. Posible ataque de depredador o enjambre.`
        });
    } else if (data.audio > THRESHOLDS.AUDIO_WARNING_HIGH) {
        if (currentStatus === 'status-ok') currentStatus = 'status-warning';
        alertMessages.push({
            severity: 'status-warning',
            message: `Ruido Alto: Nivel ${data.audio}. Posible cambio climático o actividad inusual.`
        });
    }
    
    // D. Peso (Simulación: No tenemos datos históricos aquí, solo el valor actual)
    // Para simplificar, solo verificaremos si el valor está presente.
    if (!data.weight || data.weight < 1) { 
        if (currentStatus === 'status-ok') currentStatus = 'status-warning';
        alertMessages.push({
            severity: 'status-warning',
            message: `Peso no detectado o en 0g. Revisar sensor de peso.`
        });
    }


    // =======================================================
    // 3. ACTUALIZACIÓN DE TEXTO DE RESUMEN
    // =======================================================

    if (currentStatus === 'status-danger') {
        summaryText = `ALERTA CRÍTICA: Se detectaron ${alertMessages.length} problemas graves.`;
    } else if (currentStatus === 'status-warning') {
        summaryText = `ADVERTENCIA: ${alertMessages.length} parámetros están fuera de rango óptimo.`;
    } else {
        summaryText = 'Colmena OK: Todos los parámetros están en el rango óptimo.';
    }

    // =======================================================
    // 4. ACTUALIZACIÓN DE VISUALES
    // =======================================================
    updateAlertVisuals(currentStatus, summaryText, alertMessages, summaryEl, alertListEl, summaryHeaderEl, alertCountSummaryEl);
}


/**
 * Función auxiliar para aplicar los estilos y textos en el DOM.
 */
function updateAlertVisuals(status, summaryText, messages, summaryEl, alertListEl, summaryHeaderEl, alertCountSummaryEl) {
    
    // 1. Limpiar estilos y aplicar el nuevo
    summaryEl.className = 'alert-summary'; 
    summaryEl.classList.add(status);
    
    // 2. Actualizar el texto del resumen principal
    summaryEl.querySelector('h2').textContent = summaryText;

    // 3. Actualizar el contador discreto en la tarjeta de gráficos (card-general)
    if (alertCountSummaryEl) {
        alertCountSummaryEl.textContent = messages.length > 0 ? messages.length : 'Ninguna';
    }
    
    // 4. Limpiar y llenar la lista de alertas (Detalles)
    if (alertListEl) {
        alertListEl.innerHTML = '';
        if (messages.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No hay alertas activas en este momento.';
            alertListEl.appendChild(li);
        } else {
            messages.forEach(alert => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="status-alert-icon ${alert.severity}">&#9888;</span> ${alert.message}`;
                alertListEl.appendChild(li);
            });
        }
    }
}