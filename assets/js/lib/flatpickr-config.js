/* ============================================
   FLATPICKR-CONFIG.JS
   Configuración centralizada de Flatpickr para MyCuscoTrip
   ============================================ */

/**
 * Configuración global de Flatpickr para la aplicación
 */
const FlatpickrConfig = {
    // Configuración base común
    baseConfig: {
        locale: 'es',
        altInput: true,
        altFormat: "d M Y",
        dateFormat: "Y-m-d",
        minDate: "today",
        clickOpens: true,
        disableMobile: true, // Usamos nuestra propia implementación móvil
        closeOnSelect: false,
        rangeSeparator: " → ",
        showMonths: 1,
        static: false,
        position: "below left",
        
        // Textos en español
        monthSelect: true,
        months: {
            shorthand: [
                "Ene", "Feb", "Mar", "Abr", "May", "Jun",
                "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
            ],
            longhand: [
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
            ]
        },
        weekdays: {
            shorthand: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
            longhand: [
                "Domingo", "Lunes", "Martes", "Miércoles", 
                "Jueves", "Viernes", "Sábado"
            ]
        },
        firstDayOfWeek: 1, // Lunes
    },

    // Configuración específica para Tours (fecha única)
    toursConfig: {
        mode: "single",
        placeholder: "Selecciona fecha",
        altInputPlaceholder: "Selecciona fecha",
        
        // Estilos personalizados
        theme: "custom",
        
        // Días deshabilitados (fines de semana opcional)
        disable: [
            function(date) {
                // Ejemplo: deshabilitar domingos
                // return date.getDay() === 0;
                return false;
            }
        ],
        
        // Eventos importantes en Perú (ejemplo)
        enable: [
            // Fechas especiales
            // "2024-06-24", // Inti Raymi
            // "2024-07-28", // Fiestas Patrias
        ]
    },

    // Configuración específica para Paquetes (rango de fechas)
    packagesConfig: {
        mode: "range",
        placeholder: "Inicio → Fin",
        altInputPlaceholder: "Inicio → Fin",
        
        // Mínimo y máximo de días para paquetes
        minDays: 1,
        maxDays: 30,
        
        // Validación personalizada para rangos
        validateDate: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                const start = selectedDates[0];
                const end = selectedDates[1];
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < instance.config.minDays) {
                    return `Mínimo ${instance.config.minDays} día(s)`;
                }
                
                if (diffDays > instance.config.maxDays) {
                    return `Máximo ${instance.config.maxDays} días`;
                }
            }
            return true;
        }
    },

    // Configuración para móviles
    mobileConfig: {
        static: true,
        position: "center",
        showMonths: 1,
        inline: false
    },

    // Configuración para desktop
    desktopConfig: {
        static: false,
        position: "below left",
        showMonths: function() {
            return window.innerWidth >= 1280 ? 2 : 1;
        }
    },

    // Plugin de confirmación personalizado
    confirmPluginConfig: {
        confirmText: "OK",
        showAlways: true,
        theme: "custom",
        
        // Estilos personalizados para el botón OK
        confirmButtonClass: "flatpickr-confirm",
        
        // Texto personalizado
        confirmText: "Seleccionar",
        
        // Icono (opcional)
        confirmIcon: `<i class="fas fa-check"></i>`
    }
};

/**
 * Crea una instancia de Flatpickr con la configuración adecuada
 * @param {HTMLElement} element - Elemento input
 * @param {Object} options - Opciones adicionales
 * @returns {Object} Instancia de Flatpickr
 */
function createFlatpickrInstance(element, options = {}) {
    // Determinar si es para tours o paquetes
    const isPackages = options.mode === 'range' || element.dataset.mode === 'range';
    const baseModeConfig = isPackages ? 
        FlatpickrConfig.packagesConfig : 
        FlatpickrConfig.toursConfig;
    
    // Determinar configuración responsive
    const isMobile = window.innerWidth < 1024;
    const responsiveConfig = isMobile ? 
        FlatpickrConfig.mobileConfig : 
        FlatpickrConfig.desktopConfig;
    
    // Combinar configuraciones
    const finalConfig = {
        ...FlatpickrConfig.baseConfig,
        ...baseModeConfig,
        ...responsiveConfig,
        ...options,
        
        // Configuración específica del elemento
        appendTo: options.appendTo || element.parentElement,
        
        // Plugins
        plugins: options.plugins || [
            new confirmDatePlugin(FlatpickrConfig.confirmPluginConfig)
        ],
        
        // Callbacks
        onReady: function(selectedDates, dateStr, instance) {
            // Aplicar estilos personalizados
            applyCustomStyles(instance);
            
            // Ejecutar callback personalizado si existe
            if (options.onReady) {
                options.onReady.call(this, selectedDates, dateStr, instance);
            }
        },
        
        onChange: function(selectedDates, dateStr, instance) {
            // Validación para paquetes
            if (isPackages && selectedDates.length === 2) {
                const validation = baseModeConfig.validateDate?.call(this, selectedDates, dateStr, instance);
                if (validation !== true) {
                    console.warn('Validación de fecha:', validation);
                    // Podrías mostrar un mensaje al usuario aquí
                }
            }
            
            // Ejecutar callback personalizado si existe
            if (options.onChange) {
                options.onChange.call(this, selectedDates, dateStr, instance);
            }
        },
        
        onOpen: function(selectedDates, dateStr, instance) {
            // Asegurar posición correcta en móviles
            if (isMobile) {
                instance.calendarContainer.style.position = 'fixed';
                instance.calendarContainer.style.top = '50%';
                instance.calendarContainer.style.left = '50%';
                instance.calendarContainer.style.transform = 'translate(-50%, -50%)';
            }
            
            // Ejecutar callback personalizado si existe
            if (options.onOpen) {
                options.onOpen.call(this, selectedDates, dateStr, instance);
            }
        },
        
        onClose: function(selectedDates, dateStr, instance) {
            // Limpiar estilos si es necesario
            if (isMobile) {
                instance.calendarContainer.style.position = '';
                instance.calendarContainer.style.top = '';
                instance.calendarContainer.style.left = '';
                instance.calendarContainer.style.transform = '';
            }
            
            // Ejecutar callback personalizado si existe
            if (options.onClose) {
                options.onClose.call(this, selectedDates, dateStr, instance);
            }
        }
    };
    
    // Crear instancia
    const instance = flatpickr(element, finalConfig);
    
    // Guardar referencia para acceso futuro
    element._flatpickr = instance;
    
    return instance;
}

/**
 * Aplica estilos personalizados al calendario
 * @param {Object} instance - Instancia de Flatpickr
 */
function applyCustomStyles(instance) {
    const container = instance.calendarContainer;
    
    if (!container) return;
    
    // Añadir clase personalizada
    container.classList.add('mct-flatpickr');
    
    // Estilos adicionales
    container.style.fontFamily = "'Open Sans', sans-serif";
    container.style.borderRadius = "16px";
    container.style.overflow = "hidden";
    container.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.22)";
    
    // Botón de confirmación personalizado
    const confirmBtn = container.querySelector('.flatpickr-confirm');
    if (confirmBtn) {
        confirmBtn.style.background = "var(--mct-primary, #062803)";
        confirmBtn.style.color = "#fff";
        confirmBtn.style.border = "0";
        confirmBtn.style.borderRadius = "14px";
        confirmBtn.style.height = "46px";
        confirmBtn.style.margin = "12px";
        confirmBtn.style.width = "calc(100% - 24px)";
        confirmBtn.style.display = "flex";
        confirmBtn.style.alignItems = "center";
        confirmBtn.style.justifyContent = "center";
        confirmBtn.style.cursor = "pointer";
        confirmBtn.style.fontWeight = "950";
        confirmBtn.style.fontFamily = "'Montserrat', sans-serif";
        confirmBtn.style.boxShadow = "0 14px 30px rgba(6, 40, 3, 0.18)";
        
        // Remover SVG por defecto y agregar texto
        const svg = confirmBtn.querySelector('svg');
        if (svg) svg.style.display = 'none';
        
        if (!confirmBtn.querySelector('.confirm-text')) {
            const textSpan = document.createElement('span');
            textSpan.className = 'confirm-text';
            textSpan.textContent = "OK";
            textSpan.style.fontWeight = "950";
            confirmBtn.appendChild(textSpan);
        }
    }
    
    // Días personalizados
    const days = container.querySelectorAll('.flatpickr-day');
    days.forEach(day => {
        day.style.borderRadius = "12px";
        day.style.fontWeight = "900";
        day.style.border = "0";
    });
    
    // Día actual
    const today = container.querySelector('.flatpickr-day.today');
    if (today) {
        today.style.border = "1px solid var(--mct-primary, #062803)";
        today.style.background = "transparent";
    }
    
    // Días seleccionados
    const selectedDays = container.querySelectorAll('.flatpickr-day.selected');
    selectedDays.forEach(day => {
        day.style.background = "var(--mct-primary, #062803)";
        day.style.color = "#fff";
    });
}

/**
 * Calcula la duración en días y noches entre dos fechas
 * @param {Date|string} startDate - Fecha de inicio
 * @param {Date|string} endDate - Fecha de fin
 * @returns {Object|null} Objeto con días y noches, o null si hay error
 */
function calculateDuration(startDate, endDate) {
    try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Ajustar a mediodía para evitar problemas de horario
        start.setHours(12, 0, 0, 0);
        end.setHours(12, 0, 0, 0);
        
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return null;
        
        return {
            days: diffDays + 1,
            nights: diffDays,
            weeks: Math.floor(diffDays / 7),
            weekends: calculateWeekends(start, end)
        };
    } catch (error) {
        console.error('Error calculando duración:', error);
        return null;
    }
}

/**
 * Calcula cuántos fines de semana hay en un rango de fechas
 * @param {Date} start - Fecha de inicio
 * @param {Date} end - Fecha de fin
 * @returns {number} Cantidad de fines de semana completos
 */
function calculateWeekends(start, end) {
    let weekends = 0;
    const current = new Date(start);
    
    while (current <= end) {
        // Si es sábado, contamos un fin de semana
        if (current.getDay() === 6) {
            weekends++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    return weekends;
}

/**
 * Formatea una fecha para mostrar al usuario
 * @param {Date|string} date - Fecha a formatear
 * @param {string} format - Formato deseado ('short', 'medium', 'long', 'range')
 * @returns {string} Fecha formateada
 */
function formatDateForDisplay(date, format = 'medium') {
    if (!date) return '';
    
    const d = new Date(date);
    const formats = {
        short: {
            day: 'numeric',
            month: 'short'
        },
        medium: {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        },
        long: {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }
    };
    
    return d.toLocaleDateString('es-ES', formats[format] || formats.medium);
}

/**
 * Valida si una fecha está disponible (no está en lista de bloqueadas)
 * @param {Date} date - Fecha a validar
 * @param {Array} blockedDates - Array de fechas bloqueadas
 * @returns {boolean} True si está disponible
 */
function isDateAvailable(date, blockedDates = []) {
    const dateStr = date.toISOString().split('T')[0];
    return !blockedDates.includes(dateStr);
}

/**
 * Obtiene las próximas fechas disponibles (excluyendo bloqueadas)
 * @param {number} count - Cantidad de fechas a obtener
 * @param {Array} blockedDates - Fechas bloqueadas
 * @returns {Array} Array de fechas disponibles
 */
function getNextAvailableDates(count = 5, blockedDates = []) {
    const availableDates = [];
    const today = new Date();
    
    for (let i = 0; availableDates.length < count; i++) {
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + i);
        
        if (isDateAvailable(nextDate, blockedDates)) {
            availableDates.push(new Date(nextDate));
        }
    }
    
    return availableDates;
}

/**
 * Convierte un rango de fechas a string legible
 * @param {Date} start - Fecha de inicio
 * @param {Date} end - Fecha de fin
 * @returns {string} Rango formateado
 */
function formatDateRange(start, end) {
    if (!start || !end) return '';
    
    const startStr = formatDateForDisplay(start, 'short');
    const endStr = formatDateForDisplay(end, 'short');
    
    // Si es el mismo mes, mostrar solo una vez el mes
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return `${start.getDate()} - ${end.getDate()} ${formatDateForDisplay(start, 'short').split(' ')[1]}`;
    }
    
    return `${startStr} → ${endStr}`;
}

/**
 * Maneja el cambio entre modo móvil y desktop
 * @param {Object} instance - Instancia de Flatpickr
 * @param {boolean} isMobile - Si está en modo móvil
 */
function handleResponsiveChange(instance, isMobile) {
    if (!instance || !instance.calendarContainer) return;
    
    if (isMobile) {
        instance.set('static', true);
        instance.set('position', 'center');
        instance.set('showMonths', 1);
        
        // Aplicar estilos para móvil
        instance.calendarContainer.style.maxWidth = '90vw';
        instance.calendarContainer.style.maxHeight = '80vh';
        instance.calendarContainer.style.overflow = 'auto';
    } else {
        instance.set('static', false);
        instance.set('position', 'below left');
        instance.set('showMonths', window.innerWidth >= 1280 ? 2 : 1);
        
        // Remover estilos móviles
        instance.calendarContainer.style.maxWidth = '';
        instance.calendarContainer.style.maxHeight = '';
    }
}

/**
 * Configura un input de fecha con todas las funcionalidades
 * @param {string|HTMLElement} selector - Selector o elemento input
 * @param {Object} options - Opciones adicionales
 * @returns {Object} Objeto con métodos para controlar el datepicker
 */
function setupDatePicker(selector, options = {}) {
    const element = typeof selector === 'string' ? 
        document.querySelector(selector) : selector;
    
    if (!element) {
        console.error('Elemento no encontrado:', selector);
        return null;
    }
    
    // Configuración por defecto
    const defaults = {
        onDateSelect: null,
        onRangeSelect: null,
        blockedDates: [],
        minDays: 1,
        maxDays: 30,
        isPackages: false
    };
    
    const config = { ...defaults, ...options };
    
    // Crear instancia de Flatpickr
    const instance = createFlatpickrInstance(element, {
        mode: config.isPackages ? 'range' : 'single',
        minDate: 'today',
        disable: config.blockedDates,
        ...(config.isPackages && {
            minDays: config.minDays,
            maxDays: config.maxDays
        }),
        
        onChange: function(selectedDates) {
            if (config.isPackages && selectedDates.length === 2) {
                const duration = calculateDuration(selectedDates[0], selectedDates[1]);
                if (config.onRangeSelect) {
                    config.onRangeSelect(selectedDates, duration);
                }
            } else if (selectedDates.length === 1 && config.onDateSelect) {
                config.onDateSelect(selectedDates[0]);
            }
        }
    });
    
    // Métodos públicos
    return {
        // Obtener la instancia de Flatpickr
        getInstance: () => instance,
        
        // Abrir el datepicker
        open: () => instance.open(),
        
        // Cerrar el datepicker
        close: () => instance.close(),
        
        // Limpiar fechas seleccionadas
        clear: () => instance.clear(),
        
        // Establecer fechas
        setDate: (date) => instance.setDate(date, true),
        
        // Obtener fechas seleccionadas
        getSelectedDates: () => instance.selectedDates,
        
        // Obtener duración (para paquetes)
        getDuration: () => {
            const dates = instance.selectedDates;
            if (dates.length === 2) {
                return calculateDuration(dates[0], dates[1]);
            }
            return null;
        },
        
        // Verificar si una fecha está disponible
        isDateAvailable: (date) => isDateAvailable(date, config.blockedDates),
        
        // Obtener próximas fechas disponibles
        getNextAvailableDates: (count) => getNextAvailableDates(count, config.blockedDates),
        
        // Destruir instancia
        destroy: () => {
            if (instance && instance.destroy) {
                instance.destroy();
            }
            if (element._flatpickr) {
                delete element._flatpickr;
            }
        },
        
        // Actualizar configuración
        updateConfig: (newOptions) => {
            instance.destroy();
            const updatedInstance = setupDatePicker(element, { ...config, ...newOptions });
            return updatedInstance;
        }
    };
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ Flatpickr Config cargado');
    
    // Aplicar estilos globales si es necesario
    if (!document.querySelector('#flatpickr-global-styles')) {
        const style = document.createElement('style');
        style.id = 'flatpickr-global-styles';
        style.textContent = `
            .mct-flatpickr .flatpickr-day.selected {
                background: var(--mct-primary, #062803) !important;
                color: #fff !important;
                border-color: var(--mct-primary, #062803) !important;
            }
            
            .mct-flatpickr .flatpickr-day.inRange {
                background: rgba(6, 40, 3, 0.16) !important;
                color: var(--mct-primary, #062803) !important;
            }
            
            .mct-flatpickr .flatpickr-day.today {
                border: 1px solid var(--mct-primary, #062803) !important;
                background: transparent !important;
            }
            
            .mct-flatpickr .flatpickr-day:hover {
                background: rgba(6, 40, 3, 0.08) !important;
            }
        `;
        document.head.appendChild(style);
    }
});

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FlatpickrConfig,
        createFlatpickrInstance,
        calculateDuration,
        formatDateForDisplay,
        isDateAvailable,
        getNextAvailableDates,
        formatDateRange,
        handleResponsiveChange,
        setupDatePicker
    };
}
