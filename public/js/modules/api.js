// public/js/modules/api.js

import { checkHiveStatus } from './status.js';
import { showHistoryChart } from './charts.js';

// Variables globales exportadas. Almacenan solo la fecha (AAAA-MM-DD)
export let maxDate = ''; 
export let minDate = ''; 
export let cachedHistoryData = []; 

// =======================================================
// 1. OBTENER Y ACTUALIZAR DATOS EN TIEMPO REAL
// =======================================================

/**
 * Llama a la API para obtener los últimos datos y actualizar las tarjetas.
 */
export async function updateLatestData() {
    try {
        const response = await fetch('/latest'); 
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();

        // ----------------------------------------------------
        // LÓGICA DE MANEJO SIN DATOS
        // ----------------------------------------------------
        if (!data || Object.keys(data).length === 0) {
            document.getElementById('weight-value').textContent = '-- g';
            document.getElementById('temp-value').textContent = '-- °C';
            document.getElementById('hum-value').textContent = '-- %';
            document.getElementById('audio-value').textContent = '--';
            
            // Limpiamos los tiempos en todas las tarjetas y el resumen de alerta
            const noDataTime = 'No hay datos';
            // ✅ FIX: Array extendido para incluir 'last-check-time'
            ['weight-time', 'temp-time', 'hum-time', 'audio-time', 'last-check-time'].forEach(id => {
                const timeEl = document.getElementById(id);
                if (timeEl) timeEl.textContent = noDataTime;
            });

            checkHiveStatus(null); 
            return;
        }

        // 1. Actualización de valores en tarjetas
        document.getElementById('weight-value').textContent = `${(data.weight ?? 0).toFixed(2)} g`;
        document.getElementById('temp-value').textContent = `${(data.temperature ?? 0).toFixed(1)} °C`;
        document.getElementById('hum-value').textContent = `${(data.humidity ?? 0).toFixed(0)} %`;
        document.getElementById('audio-value').textContent = `${data.audio ?? '--'}`;
        
        // ----------------------------------------------------
        // LÓGICA DE ACTUALIZACIÓN DE TIEMPO
        // ----------------------------------------------------
        const date = new Date(data.timestamp);
        const formattedTime = date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        // Itera sobre todos los IDs de tiempo y actualiza su contenido
        // ✅ FIX: Se usa el ID correcto 'last-check-time'
        const timeElementIds = ['weight-time', 'temp-time', 'hum-time', 'audio-time', 'last-check-time']; 

        timeElementIds.forEach(id => {
            const timeEl = document.getElementById(id);
            if (timeEl) {
                timeEl.textContent = formattedTime;
            }
        });
        // ----------------------------------------------------


        // 2. Ejecutar chequeo de estado
        checkHiveStatus(data); 
        
    } catch (error) {
        console.error('❌ Error al obtener datos actuales:', error);
        checkHiveStatus(null, error); 
    }
}


// =======================================================
// 2. LÍMITES DE FECHA (CRÍTICO para el filtro)
// =======================================================

/**
 * Obtiene los límites de fecha de la DB, los almacena y CONFIGURA los inputs de fecha.
 */
export async function fetchAndSetDateLimits() {
    try {
        // Usamos la ruta que funcionaba en tu app.js
        const response = await fetch('/data-limits'); 
        const limits = await response.json();
        
        const startDateEl = document.getElementById('start-date');
        const endDateEl = document.getElementById('end-date');

        if (limits.min_date && limits.max_date && startDateEl && endDateEl) {
            
            // 1. Guarda SÓLO la parte de la fecha (AAAA-MM-DD)
            minDate = limits.min_date.split('T')[0];
            maxDate = limits.max_date.split('T')[0];
            
            // 2. APLICA LOS LÍMITES DIRECTAMENTE AL DOM para restringir la selección
            startDateEl.min = minDate;
            startDateEl.max = maxDate;
            endDateEl.min = minDate;
            endDateEl.max = maxDate;

            // Asegura que no estén deshabilitados
            startDateEl.removeAttribute('disabled');
            endDateEl.removeAttribute('disabled');
            
            console.log(`Límites de fecha establecidos: ${minDate} a ${maxDate}`);
        } else if (startDateEl && endDateEl) {
             // Si NO hay datos en la DB, deshabilitamos el filtro
             startDateEl.disabled = true;
             endDateEl.disabled = true;
             minDate = maxDate = ''; 
        }
    } catch (error) {
        document.getElementById('start-date').disabled = true;
        document.getElementById('end-date').disabled = true;
        minDate = maxDate = '';
        console.error('❌ Error al obtener límites de fecha:', error);
    }
}


// =======================================================
// 3. OBTENER DATOS HISTÓRICOS Y DIBUJAR
// =======================================================

/**
 * Obtiene los datos históricos y actualiza los gráficos.
 * @param {boolean} useFilters - Si es true, usa los valores del formulario de filtros.
 * @param {string} overrideChartId - ID del contenedor de gráfico a mostrar (opcional).
 */
export async function fetchAndDrawHistory(useFilters = false, overrideChartId = null) {

    // Extraemos las cuatro componentes
    const startDate = document.getElementById('start-date').value; // 'AAAA-MM-DD'
    const startTime = document.getElementById('start-time').value; // 'HH:mm'
    const endDate = document.getElementById('end-date').value;     // 'AAAA-MM-DD'
    const endTime = document.getElementById('end-time').value;       // 'HH:mm'
    
    // 1. VALIDACIÓN
    if (useFilters && (!startDate || !endDate)) {
        alert('Por favor, seleccione una Fecha de Inicio y una Fecha de Fin.');
        return;
    }

    // 2. Convertimos el tiempo a 'HH:mm:ss' para consistencia con SQL
    const startTimeSec = `${startTime}:00`; 
    const endTimeSec = `${endTime}:00`;

    // 3. Construimos la URL con los cuatro parámetros separados
    const url = `/history?startDate=${startDate}&endDate=${endDate}&startTime=${startTimeSec}&endTime=${endTimeSec}`;
    
    try {
        console.log(`Petición: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error al obtener el historial: ${response.statusText}`);
        
        cachedHistoryData = await response.json();
        
        // ... resto de la lógica para dibujar el gráfico ...
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