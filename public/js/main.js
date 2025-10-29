// public/js/main.js

import { updateLatestData, fetchAndSetDateLimits, fetchAndDrawHistory } from './modules/api.js'; 
import { setupFilterEvents, setInitialFilterTimes } from './modules/filters.js'; 
import { checkHiveStatus } from './modules/status.js'; 

const UPDATE_INTERVAL = 5000; // 5 segundos

/**
 * Configura los event listeners para las tarjetas de resumen.
 */
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

                // Forzamos la recarga con el filtro actual, pero cambiamos la vista
                fetchAndDrawHistory(true, targetContainerId); 
            });
        }
    });
}

/**
 * 🎯 AÑADIDO: Configura el botón para mostrar/ocultar el formulario de filtros en móvil.
 */
function setupFilterToggle() {
    const toggleButton = document.getElementById('toggle-filter-btn');
    const filterForm = document.getElementById('history-filter-form');

    if (toggleButton && filterForm) {
        toggleButton.addEventListener('click', () => {
            filterForm.classList.toggle('active');
            
            // Cambiar el texto del botón al abrir/cerrar
            if (filterForm.classList.contains('active')) {
                toggleButton.textContent = '✕ Cerrar Opciones';
            } else {
                toggleButton.textContent = '☰ Opciones de Filtrado';
            }
        });
    }
}


// =======================================================
// BLOQUE DE INICIALIZACIÓN
// =======================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard cargado. Inicializando módulos...');
    
    // 0. FORZAR ESTADO INICIAL
    checkHiveStatus(null); 

    setupCardClickListeners();
    setupFilterEvents();
    setupFilterToggle(); // 🎯 LA LLAMADA CRÍTICA PARA EL MENÚ
    
    // 1. Iniciar la actualización de datos en tiempo real
    updateLatestData();
    setInterval(updateLatestData, UPDATE_INTERVAL);
    
    // 2. Cargar historial y límites de fecha de forma asíncrona
    fetchAndSetDateLimits().then(() => {
        // Establecer los valores iniciales de fecha y hora (7 días atrás)
        setInitialFilterTimes(); 
        // Cargar y dibujar el historial inicial
        fetchAndDrawHistory(); 
    });
});