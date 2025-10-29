// public/app.js (CÓDIGO COMPLETO Y CORREGIDO: Etiquetas simplificadas)

// =======================================================
// CONFIGURACIÓN E INICIALIZACIÓN
// =======================================================
const UPDATE_INTERVAL = 5000; // 5 segundos
const DEFAULT_HISTORY_DAYS = 7;

const HIVE_THRESHOLDS = {
    WEIGHT_LOW: 15000, 
    TEMP_HIGH: 36, 
    TEMP_LOW: 30, 
    HUMIDITY_HIGH: 70, 
    AUDIO_HIGH: 3000, 
};

let weightChart = null; 
let audioGeneralChart = null; 
let tempIndividualChart = null; 
let humIndividualChart = null; 
let audioIndividualChart = null; 
let weightGeneralChart = null;
let tempGeneralChart = null;
let humGeneralChart = null;

let cachedHistoryData = []; 

// Variables para límites de fecha
let maxDate = ''; // Contiene AAAA-MM-DD
let minDate = ''; // Contiene AAAA-MM-DD

// =======================================================
// 1. OBTENER Y ACTUALIZAR DATOS EN TIEMPO REAL
// =======================================================

async function updateLatestData() {
    try {
        const response = await fetch('/latest'); 
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();

        if (!data || Object.keys(data).length === 0) {
            document.getElementById('weight-value').textContent = '-- g';
            document.getElementById('temp-value').textContent = '-- °C';
            document.getElementById('hum-value').textContent = '-- %';
            document.getElementById('audio-value').textContent = '--';
            // CRÍTICO: Corregir el ID del tiempo en el HTML
            document.getElementById('weight-time').textContent = 'No hay datos';
            checkHiveStatus(null); 
            return;
        }

        // 1. Actualización de valores en tarjetas
        document.getElementById('weight-value').textContent = `${(data.weight ?? 0).toFixed(2)} g`;
        document.getElementById('temp-value').textContent = `${(data.temperature ?? 0).toFixed(1)} °C`;
        document.getElementById('hum-value').textContent = `${(data.humidity ?? 0).toFixed(0)} %`;
        document.getElementById('audio-value').textContent = `${data.audio ?? '--'}`;
        
        const date = new Date(data.timestamp);
        // CRÍTICO: Corregir el ID del tiempo en el HTML (asumo que es un ID para la hora)
        document.getElementById('weight-time').textContent = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        // 2. Ejecutar chequeo de estado con los datos válidos
        checkHiveStatus(data); 
        
    } catch (error) {
        console.error('❌ Error al obtener datos actuales:', error);
        checkHiveStatus(null, error); 
    }
}

// =======================================================
// 2. FUNCIÓN DE CHEQUEO DE ESTADO Y ALERTAS
// =======================================================

function checkHiveStatus(data, error = null) {
    const alerts = [];
    let overallStatus = 'status-ok'; 

    const listElement = document.getElementById('alert-list');
    const summaryElement = document.getElementById('hive-status-message'); // Mensaje principal
    const generalCardDisplay = document.getElementById('general-status-display'); // Mensaje en la tarjeta
    const summaryBlock = document.querySelector('.alert-summary');
    const timeElement = document.getElementById('last-check-time');
    
    listElement.innerHTML = ''; 
    
    if (timeElement) {
        timeElement.textContent = new Date().toLocaleTimeString('es-ES');
    }

    if (!summaryElement) {
        console.error("❌ CRÍTICO: No se encontró el elemento #hive-status-message. Revise index.ejs.");
        return;
    }

    // 1. Manejo de Errores de Conexión
    if (error) {
        alerts.push({ type: 'danger', message: `Error de Conexión: No se pudo obtener la información del servidor.`, icon: '❌' });
        overallStatus = 'status-danger';
    } 
    // 2. Manejo de DB Vacía o sin datos
    else if (!data) {
        alerts.push({ type: 'warning', message: `No hay datos recientes en la base de datos. ESP32 inactivo.`, icon: '⚠️' });
        overallStatus = 'status-warning';
    } 
    // 3. Chequeo de Umbrales (Solo si hay datos)
    else {
        const weight = data.weight ?? 0;
        const temperature = data.temperature ?? 0;
        const humidity = data.humidity ?? 0;
        const audio = data.audio ?? 0;
        
        if (weight < HIVE_THRESHOLDS.WEIGHT_LOW) {
            alerts.push({ type: 'warning', message: `Bajo peso (${weight.toFixed(2)} g). Requiere chequeo.`, icon: '📉' });
            if (overallStatus === 'status-ok') overallStatus = 'status-warning';
        }
        if (temperature > HIVE_THRESHOLDS.TEMP_HIGH) {
            alerts.push({ type: 'danger', message: `¡Temperatura Alta! (${temperature.toFixed(1)} °C). Riesgo.`, icon: '🔥' });
            overallStatus = 'status-danger';
        } else if (temperature < HIVE_THRESHOLDS.TEMP_LOW) {
            alerts.push({ type: 'warning', message: `Temperatura Baja (${temperature.toFixed(1)} °C). Problema de aislamiento.`, icon: '❄️' });
            if (overallStatus === 'status-ok') overallStatus = 'status-warning';
        }
        if (humidity > HIVE_THRESHOLDS.HUMIDITY_HIGH) {
            alerts.push({ type: 'warning', message: `Humedad Alta (${humidity.toFixed(0)} %). Riesgo.`, icon: '💧' });
            if (overallStatus === 'status-ok') overallStatus = 'status-warning';
        }
        if (audio > HIVE_THRESHOLDS.AUDIO_HIGH) {
            alerts.push({ type: 'danger', message: `Ruido Alto Detectado (${audio}). Posible actividad de enjambre.`, icon: '🔊' });
            overallStatus = 'status-danger';
        }
    }

    // 4. Actualización del Resumen 
    let finalMessage = 'Todo en Orden.';
    
    if (alerts.length === 0 && data) {
        // Todo OK
        finalMessage = 'Todo en Orden. Colmena estable.';
        summaryBlock.className = 'alert-summary status-ok';
        listElement.innerHTML = '<li><span class="status-alert-icon">✅</span> No se detectaron problemas críticos.</li>';
    } else {
        // Alertas, sin datos o error
        summaryBlock.className = `alert-summary ${overallStatus}`;
        
        if (alerts.length > 0) {
            finalMessage = `🚨 ${alerts.length} ALERTA(S) DETECTADA(S)`;
        } else if (error) {
            finalMessage = '❌ Error de Conexión.';
        } else if (!data) {
            finalMessage = '⚠️ No hay datos recientes.';
        }

        alerts.forEach(alert => {
            const listItem = document.createElement('li');
            listItem.className = `status-${alert.type}`;
            listItem.innerHTML = `<span class="status-alert-icon">${alert.icon}</span> ${alert.message}`;
            listElement.appendChild(listItem);
        });
    }
    
    // Sobrescribe el texto
    summaryElement.textContent = finalMessage; 
    
    // Actualiza el texto en la tarjeta general
    if (generalCardDisplay) {
        generalCardDisplay.textContent = finalMessage.replace('🚨', '').replace('⚠️', '').replace('❌', '').trim();
    }
}


// =======================================================
// 3. CONTROL DE VISTAS Y FILTROS 
// =======================================================

// LÓGICA DE LISTENERS DE TARJETAS 
function setupCardClickListeners() {
    const cardMap = {
        'card-general': { containerId: 'general-chart-container', title: 'Histórico General' },
        'card-weight': { containerId: 'weight-chart-container', title: 'Histórico de Peso (g)' },
        'card-temp': { containerId: 'temp-individual-chart-container', title: 'Histórico de Temperatura (°C)' },
        'card-hum': { containerId: 'hum-individual-chart-container', title: 'Histórico de Humedad (%)' },
        'card-audio': { containerId: 'audio-individual-chart-container', title: 'Histórico de Ruido (0-4095)' },
    };
    
    Object.keys(cardMap).forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) {
            card.addEventListener('click', () => {
                const targetContainerId = cardMap[cardId].containerId;

                if (cachedHistoryData.length > 0 || targetContainerId === 'general-chart-container') {
                    showHistoryChart(targetContainerId, cardMap[cardId].title);
                } else {
                    // Si no hay datos, forzamos la recarga de historia (podría estar el filtro aplicado)
                    fetchAndDrawHistory(false, targetContainerId); 
                    showHistoryChart(targetContainerId, cardMap[cardId].title);
                }
            });
        }
    });
}

// LÓGICA DE FILTROS 
function setupFilterEvents() {
    const filterForm = document.getElementById('history-filter-form');
    const resetButton = document.getElementById('reset-filter-btn');

    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        fetchAndDrawHistory(true); // El 'true' indica que usamos los filtros del formulario
    });

    // CORRECCIÓN: Al restablecer, borramos los campos y recargamos con valores iniciales
    resetButton.addEventListener('click', () => {
        document.getElementById('history-filter-form').reset();
        setInitialFilterTimes(); 
        fetchAndDrawHistory(true); // Recargar con los nuevos valores iniciales
    });
}

// LÓGICA DE FECHAS (CRÍTICO: Configuración de min/max para input date)
async function fetchAndSetDateLimits() {
    try {
        const response = await fetch('/data-limits');
        const limits = await response.json();
        
        if (limits.min_date && limits.max_date) {
            // Guarda solo la parte de la fecha (AAAA-MM-DD)
            maxDate = limits.max_date.split('T')[0];
            minDate = limits.min_date.split('T')[0];

            // Establece los límites MÍNIMO y MÁXIMO del selector de fecha (Browser Validation)
            document.getElementById('start-date').min = minDate;
            document.getElementById('start-date').max = maxDate;
            document.getElementById('end-date').min = minDate;
            document.getElementById('end-date').max = maxDate;
            
            console.log(`Límites de fecha establecidos: ${minDate} a ${maxDate}`);
        } else {
             // Si no hay datos, deshabilitar la selección de fecha
             document.getElementById('start-date').disabled = true;
             document.getElementById('end-date').disabled = true;
        }
    } catch (error) {
        console.error('Error al obtener límites de fecha:', error);
    }
}

// CRÍTICO: setInitialFilterTimes CORREGIDO para usar el formato 24h
function setInitialFilterTimes() {
    const now = new Date();
    
    // 1. La fecha de fin es HOY, pero limitada por el maxDate de los datos.
    const maxDataDate = maxDate ? new Date(maxDate) : now;
    const endDate = maxDataDate.toISOString().split('T')[0];

    // 2. Fecha de inicio: Hoy - 7 días (por defecto), basándose en la fecha máxima de datos
    const sevenDaysAgo = new Date(maxDataDate.getTime() - DEFAULT_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    let startDate;

    if (minDate) {
        const minDataDate = new Date(minDate);

        if (sevenDaysAgo < minDataDate) {
            startDate = minDate;
        } else {
            startDate = sevenDaysAgo.toISOString().split('T')[0];
        }
    } else {
        startDate = sevenDaysAgo.toISOString().split('T')[0];
    }

    // 3. Configuración de Horas (USO DE FORMATO 24H)
    document.getElementById('start-date').value = startDate;
    document.getElementById('start-time').value = '00:00';
    
    document.getElementById('end-date').value = endDate;
    // CRÍTICO: Usamos '23:59' o la hora actual en formato 24h (hour12: false)
    const endTimeValue = (endDate === now.toISOString().split('T')[0]) 
        ? now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }) 
        : '23:59';
    document.getElementById('end-time').value = endTimeValue;
}

// CRÍTICO: fetchAndDrawHistory CORREGIDO para construir el ISO String correctamente
async function fetchAndDrawHistory(useFilters = false, overrideChartId = null) {
    let start, end; 

    const startDate = document.getElementById('start-date').value;
    const startTime = document.getElementById('start-time').value; // HH:mm (24h)
    const endDate = document.getElementById('end-date').value;
    const endTime = document.getElementById('end-time').value;     // HH:mm (24h)
    
    // 1. VALIDACIÓN
    if (useFilters && (!startDate || !endDate)) {
        alert('Por favor, seleccione una Fecha de Inicio y una Fecha de Fin.');
        return;
    }

    // 2. 🔥 CORRECCIÓN CLAVE: COMBINA LA CADENA Y ENVÍALA DIRECTAMENTE
    // Construimos la cadena "AAAA-MM-DD HH:mm:ss" sin usar new Date().toISOString()
    // Esto previene el desfase de zona horaria del navegador.
    start = `${startDate} ${startTime}:00`; 
    end = `${endDate} ${endTime}:00`;
    
    // Si tu backend requiere el formato ISO 8601 con 'T'
    // start = `${startDate}T${startTime}:00`; 
    // end = `${endDate}T${endTime}:00`; 

    // 💡 IMPORTANTE: Si tu backend necesita que los espacios sean URL-Encoded, usa:
    const startParam = encodeURIComponent(start);
    const endParam = encodeURIComponent(end);
    
    try {
        // Enviar las cadenas combinadas y codificadas.
        const response = await fetch(`/history?start=${startParam}&end=${endParam}`);
        if (!response.ok) throw new Error('Error al obtener el historial');
        
        cachedHistoryData = await response.json();
        
        // ... (resto de la lógica de dibujo)
        const chartIdToShow = overrideChartId || 'general-chart-container';
        const titleMap = {
            'general-chart-container': 'Histórico General',
            'weight-chart-container': 'Histórico de Peso (g)',
            'temp-individual-chart-container': 'Histórico de Temperatura (°C)',
            'hum-individual-chart-container': 'Histórico de Humedad (%)',
            'audio-individual-chart-container': 'Histórico de Ruido (0-4095)',
        };
        showHistoryChart(chartIdToShow, titleMap[chartIdToShow]);

    } catch (error) {
        console.error('❌ Error cargando el historial:', error);
        cachedHistoryData = [];
        showHistoryChart(overrideChartId || 'general-chart-container', 'Histórico General');
    }
}

// PREPARACIÓN DE DATOS (CRÍTICO: Simplificación de etiquetas)
function prepareChartData(data) {
    // CRÍTICO: Simplificar la etiqueta del eje X a solo hora, minuto, día y mes
    const labels = data.map(d => new Date(d.timestamp).toLocaleString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
    }).replace(',', ''));
    
    const weights = data.map(d => d.weight ?? null);
    const temperatures = data.map(d => d.temperature ?? null);
    const humidities = data.map(d => d.humidity ?? null);
    const audios = data.map(d => d.audio ?? null);

    return { labels, weights, temperatures, humidities, audios };
}

/**
 * Muestra el contenedor de gráficos solicitado, asegurando la inyección
 * de los elementos canvas necesarios.
 */
function showHistoryChart(containerId, title) {
    
    // 1. Destruir TODAS las instancias de gráficos
    [weightChart, tempIndividualChart, humIndividualChart, audioIndividualChart, weightGeneralChart, tempGeneralChart, humGeneralChart, audioGeneralChart].forEach(chart => {
        if (chart) chart.destroy();
    });
    weightChart = tempIndividualChart = humIndividualChart = audioIndividualChart = weightGeneralChart = tempGeneralChart = humGeneralChart = audioGeneralChart = null;


    // 2. Ocultar todos los contenedores y limpiar su HTML interno (CLAVE)
    document.querySelectorAll('.charts-block .chart-container').forEach(container => {
        container.classList.remove('visible');
        container.innerHTML = ''; 
    });


    // 3. Mostrar el contenedor objetivo y actualizar título
    const targetContainer = document.getElementById(containerId);
    if (!targetContainer) return;
    
    // CLAVE: Esto hará visible el contenedor y le dará espacio para dibujar
    targetContainer.classList.add('visible'); 
    document.getElementById('chart-title').textContent = `📈 ${title}`;


    if (cachedHistoryData.length > 0) {
        const { labels, weights, temperatures, humidities, audios } = prepareChartData(cachedHistoryData);
        
        // 4. INYECCIÓN DE CANVAS ANTES DE DIBUJAR 
        switch (containerId) {
            case 'general-chart-container':
                // INYECTAR 4 GRÁFICOS INDIVIDUALES
                targetContainer.innerHTML = `
                    <div class="chart-general-item">
                        <h5 class="chart-subtitle">Peso (g)</h5>
                        <canvas id="weight-general-chart"></canvas>
                    </div>
                    <div class="chart-general-item">
                        <h5 class="chart-subtitle">Temperatura (°C)</h5>
                        <canvas id="temp-general-chart"></canvas>
                    </div>
                    <div class="chart-general-item">
                        <h5 class="chart-subtitle">Humedad (%)</h5>
                        <canvas id="hum-general-chart"></canvas>
                    </div>
                    <div class="chart-general-item">
                        <h5 class="chart-subtitle">Ruido/Audio (0-4095)</h5>
                        <canvas id="audio-general-chart"></canvas>
                    </div>
                `;
                // Dibujar con IDs únicos:
                weightGeneralChart = drawIndividualChart('weight-general-chart', 'Peso (g)', labels, weights, '#8b4513', 'yWeight'); 
                tempGeneralChart = drawIndividualChart('temp-general-chart', 'Temperatura (°C)', labels, temperatures, '#dc3545', 'yTemp');
                humGeneralChart = drawIndividualChart('hum-general-chart', 'Humedad (%)', labels, humidities, '#17a2b8', 'yHum', 0, 100);
                audioGeneralChart = drawIndividualChart('audio-general-chart', 'Ruido (0-4095)', labels, audios, '#ffc107', 'yAudio');
                break;
                
            case 'weight-chart-container':
                targetContainer.innerHTML = '<canvas id="weight-chart"></canvas>';
                weightChart = drawIndividualChart('weight-chart', 'Peso (g)', labels, weights, '#8b4513', 'yWeight'); 
                break;
            case 'temp-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="temp-individual-chart"></canvas>';
                tempIndividualChart = drawIndividualChart('temp-individual-chart', 'Temperatura (°C)', labels, temperatures, '#dc3545', 'yTemp');
                break;
            case 'hum-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="hum-individual-chart"></canvas>';
                humIndividualChart = drawIndividualChart('hum-individual-chart', 'Humedad (%)', labels, humidities, '#17a2b8', 'yHum', 0, 100);
                break;
            case 'audio-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="audio-individual-chart"></canvas>';
                audioIndividualChart = drawIndividualChart('audio-individual-chart', 'Ruido (0-4095)', labels, audios, '#ffc107', 'yAudio');
                break;
        }
    } else { 
        // Si no hay datos, muestra un mensaje de no hay datos
        targetContainer.innerHTML = '<p class="no-data-message">No hay datos históricos disponibles en el rango seleccionado.</p>';
    }
}


// =======================================================
// 4. FUNCIONES DE DIBUJO DE GRÁFICOS (CHART.JS)
// =======================================================

/**
 * Función genérica para dibujar cualquier gráfico de línea individual.
 * Esta función es utilizada cuando se selecciona una sola tarjeta de dato.
 */
function drawIndividualChart(canvasId, label, labels, data, color, yAxisID, min = undefined, max = undefined) {
    const canvasElement = document.getElementById(canvasId);

    if (!canvasElement) {
        console.error(`Canvas element with ID ${canvasId} not found.`);
        return null;
    }
    const ctx = canvasElement.getContext('2d');

    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                pointRadius: 1,
                tension: 0.1,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            scales: {
                y: {
                    beginAtZero: false,
                    title: { 
                        display: false, 
                        text: label.split(' ')[0] 
                    }, 
                    min: min,
                    max: max,
                },
                x: {
                    title: { display: false }
                }
            },
            plugins: {
                legend: { display: false } 
            }
        }
    });

    return newChart;
}


/**
 * Función para dibujar uno de los cuatro gráficos pequeños de la vista general.
 */
function drawGeneralChart(canvasId, label, labels, data, color) {
    const canvasElement = document.getElementById(canvasId);
    
    if (!canvasElement) return null;

    const ctx = canvasElement.getContext('2d');
    
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: data,
                borderColor: color,
                borderWidth: 1.5,
                pointRadius: 0, 
                tension: 0.2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    display: false, 
                },
                x: {
                    display: false, 
                }
            },
            plugins: {
                tooltip: { enabled: false }, 
                legend: { display: false }
            }
        }
    });

    return newChart;
}


// =======================================================
// 5. BLOQUE DE INICIALIZACIÓN (DEBE SER EL ÚLTIMO)
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard cargado. Inicializando datos y gráficos...');
    
    // 0. FORZAR ESTADO INICIAL 
    checkHiveStatus(null); 

    setupCardClickListeners();
    setupFilterEvents();
    
    // Iniciar la actualización de datos en tiempo real y el bucle de actualización
    updateLatestData();
    setInterval(updateLatestData, UPDATE_INTERVAL);
    
    // Cargar historial y límites de fecha
    fetchAndSetDateLimits().then(() => {
        // Establecer los valores iniciales (7 días atrás) basados en los límites.
        setInitialFilterTimes(); 
        fetchAndDrawHistory(); 
    });
});