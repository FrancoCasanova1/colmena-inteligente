// public/js/modules/filters.js

import { fetchAndDrawHistory, minDate, maxDate } from './api.js';

// ✅ CORRECCIÓN: Definición de la constante requerida
const DEFAULT_HISTORY_DAYS = 7;

/**
 * Configura los eventos de submit y reset del formulario de filtros.
 */
export function setupFilterEvents() {
    // 1. Referencias a elementos existentes
    const filterForm = document.getElementById('history-filter-form');
    const resetButton = document.getElementById('reset-filter-btn');
    const filterToggleBtn = document.querySelector('.filter-toggle-btn');
    
    // ----------------------------------------------------
    // LÓGICA DE BOTÓN DE ALTERNAR 
    // ----------------------------------------------------
    // CRÍTICO: Comprueba la existencia antes de añadir el listener
    if (filterToggleBtn && filterForm) { 
        filterToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 1. Alternar la clase 'active' en el BOTÓN (para el color)
            filterToggleBtn.classList.toggle('active'); 
            
            // 2. SOLUCIÓN CRÍTICA: Quitamos/Ponemos la clase 'hidden-mobile'.
            // Esto anula directamente el display: none, resolviendo el problema de despliegue.
            filterForm.classList.toggle('hidden-mobile'); // <- ¡EL CAMBIO AQUÍ!
            
            // 3. Ya que la clase 'active' no se necesita para el despliegue, la dejamos en el botón.
            
            // 4. Eliminar el foco (para que el color vuelva al base)
            filterToggleBtn.blur();
        });
    }
    // ----------------------------------------------------


    // Lógica para el SUBMIT del formulario (Buscar)
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            fetchAndDrawHistory(true); 
            
            // Cerrar el menú después de buscar (en móvil)
            if (filterToggleBtn && !filterForm.classList.contains('hidden-mobile')) {
                filterToggleBtn.classList.remove('active');
                filterForm.classList.add('hidden-mobile'); // Vuelve a ocultar
            }
        });
    }

    // Lógica para el botón de RESET
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            document.getElementById('history-filter-form').reset();
            setInitialFilterTimes(); 
            fetchAndDrawHistory(true); 
        });
    }
}


/**
 * Llena los selectores de hora (start-time y end-time) con opciones de 00:00 a 23:00.
 * Esto es necesario porque cambiamos de input type="time" a select.
 */
export function populateHourSelectors() {
    const startSelect = document.getElementById('start-time');
    const endSelect = document.getElementById('end-time');

    if (!startSelect || !endSelect) return;

    // Limpiar opciones existentes
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';

    // Crear y añadir las opciones de 00:00 a 23:00
    for (let h = 0; h < 24; h++) {
        const hour = h.toString().padStart(2, '0'); // Formato 00, 01, ..., 23
        const value = `${hour}:00`;
        
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;

        startSelect.appendChild(option.cloneNode(true));
        endSelect.appendChild(option);
    }
}


/**
 * Establece los valores iniciales de fecha y hora en el formulario de filtros.
 */
export function setInitialFilterTimes() {
    // ⚡️ CRÍTICO: Asegurarse de que los selectores estén llenos antes de establecer valores
    populateHourSelectors();
    
    const now = new Date();
    
    const maxDataDate = maxDate ? new Date(maxDate) : now;
    const endDate = maxDataDate.toISOString().split('T')[0];

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

    // Configuración de inputs/selects
    const startDateEl = document.getElementById('start-date');
    const startTimeEl = document.getElementById('start-time');
    const endDateEl = document.getElementById('end-date');
    const endTimeEl = document.getElementById('end-time');

    if (startDateEl) startDateEl.value = startDate;
    // Inicio: '00:00'
    if (startTimeEl) startTimeEl.value = '00:00'; 
    
    if (endDateEl) endDateEl.value = endDate;

    // FIX para SELECT: La hora debe ser "HH:00" para coincidir con las opciones
    const currentHour = now.getHours().toString().padStart(2, '0'); // Solo HH
    const currentHourValue = `${currentHour}:00`; // Formato HH:00

    // Usa la hora actual si la fecha de fin es hoy, sino usa 23:00 (la última opción)
    const endTimeValue = (endDate === now.toISOString().split('T')[0]) 
        ? currentHourValue 
        : '23:00';

    if (endTimeEl) endTimeEl.value = endTimeValue;
}