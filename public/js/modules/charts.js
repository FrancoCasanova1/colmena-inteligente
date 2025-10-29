// public/js/modules/charts.js

import { cachedHistoryData } from './api.js';

// Variables para controlar las instancias de Chart.js
let weightChart = null; 
let audioGeneralChart = null; 
let tempIndividualChart = null; 
let humIndividualChart = null; 
let audioIndividualChart = null; 
let weightGeneralChart = null;
let tempGeneralChart = null;
let humGeneralChart = null;

/**
 * Procesa los datos crudos para usarlos en Chart.js.
 */
function prepareChartData(data) {
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
 * Función genérica para dibujar cualquier gráfico de línea individual.
 */
function drawIndividualChart(canvasId, label, labels, data, color, min = undefined, max = undefined) {
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
                    title: { display: false }, 
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
 * Muestra el contenedor de gráficos solicitado, asegurando la inyección
 * de los elementos canvas necesarios y dibujando los gráficos.
 */
export function showHistoryChart(containerId, title) {
    
    // 1. Destruir TODAS las instancias de gráficos y resetear variables
    [weightChart, tempIndividualChart, humIndividualChart, audioIndividualChart, weightGeneralChart, tempGeneralChart, humGeneralChart, audioGeneralChart].forEach(chart => {
        if (chart) chart.destroy();
    });
    weightChart = tempIndividualChart = humIndividualChart = audioIndividualChart = weightGeneralChart = tempGeneralChart = humGeneralChart = audioGeneralChart = null;


    // 2. Ocultar todos los contenedores y limpiar su HTML interno
    document.querySelectorAll('.charts-block .chart-container').forEach(container => {
        container.classList.remove('visible');
        container.innerHTML = ''; 
    });


    // 3. Mostrar el contenedor objetivo y actualizar título
    const targetContainer = document.getElementById(containerId);
    if (!targetContainer) return;
    
    targetContainer.classList.add('visible'); 
    document.getElementById('chart-title').textContent = `📈 ${title}`;


    if (cachedHistoryData.length > 0) {
        const { labels, weights, temperatures, humidities, audios } = prepareChartData(cachedHistoryData);
        
        // 4. INYECCIÓN DE CANVAS ANTES DE DIBUJAR 
        switch (containerId) {
            case 'general-chart-container':
                // Vista General (4 gráficos pequeños)
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
                weightGeneralChart = drawIndividualChart('weight-general-chart', 'Peso (g)', labels, weights, '#8b4513'); 
                tempGeneralChart = drawIndividualChart('temp-general-chart', 'Temperatura (°C)', labels, temperatures, '#dc3545');
                humGeneralChart = drawIndividualChart('hum-general-chart', 'Humedad (%)', labels, humidities, '#17a2b8', 0, 100);
                audioGeneralChart = drawIndividualChart('audio-general-chart', 'Ruido (0-4095)', labels, audios, '#ffc107');
                break;
                
            case 'weight-chart-container':
                targetContainer.innerHTML = '<canvas id="weight-chart"></canvas>';
                weightChart = drawIndividualChart('weight-chart', 'Peso (g)', labels, weights, '#8b4513'); 
                break;
            case 'temp-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="temp-individual-chart"></canvas>';
                tempIndividualChart = drawIndividualChart('temp-individual-chart', 'Temperatura (°C)', labels, temperatures, '#dc3545');
                break;
            case 'hum-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="hum-individual-chart"></canvas>';
                humIndividualChart = drawIndividualChart('hum-individual-chart', 'Humedad (%)', labels, humidities, '#17a2b8', 0, 100);
                break;
            case 'audio-individual-chart-container':
                targetContainer.innerHTML = '<canvas id="audio-individual-chart"></canvas>';
                audioIndividualChart = drawIndividualChart('audio-individual-chart', 'Ruido (0-4095)', labels, audios, '#ffc107');
                break;
        }
    } else { 
        targetContainer.innerHTML = '<p class="no-data-message">No hay datos históricos disponibles en el rango seleccionado.</p>';
    }
}