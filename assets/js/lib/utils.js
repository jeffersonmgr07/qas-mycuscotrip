/* ============================================
   UTILS.JS
   Funciones utilitarias para MyCuscoTrip
   ============================================ */

/**
 * Utilidades generales para la aplicación
 */
const MyCuscoTripUtils = {
    
    // ========== MANEJO DE SESIÓN Y ALMACENAMIENTO ==========
    
    /**
     * Almacena datos en localStorage con expiración opcional
     * @param {string} key - Clave para almacenar
     * @param {any} value - Valor a almacenar
     * @param {number} ttl - Tiempo de vida en segundos (opcional)
     */
    setStorage: function(key, value, ttl = null) {
        try {
            const item = {
                value: value,
                timestamp: Date.now(),
                ttl: ttl
            };
            localStorage.setItem(`mct_${key}`, JSON.stringify(item));
            return true;
        } catch (error) {
            console.error('Error almacenando en localStorage:', error);
            return false;
        }
    },
    
    /**
     * Obtiene datos de localStorage con verificación de expiración
     * @param {string} key - Clave a obtener
     * @returns {any} Valor almacenado o null
     */
    getStorage: function(key) {
        try {
            const itemStr = localStorage.getItem(`mct_${key}`);
            if (!itemStr) return null;
            
            const item = JSON.parse(itemStr);
            const now = Date.now();
            
            // Verificar si ha expirado
            if (item.ttl && now - item.timestamp > item.ttl * 1000) {
                localStorage.removeItem(`mct_${key}`);
                return null;
            }
            
            return item.value;
        } catch (error) {
            console.error('Error obteniendo de localStorage:', error);
            return null;
        }
    },
    
    /**
     * Elimina datos de localStorage
     * @param {string} key - Clave a eliminar
     */
    removeStorage: function(key) {
        try {
            localStorage.removeItem(`mct_${key}`);
            return true;
        } catch (error) {
            console.error('Error eliminando de localStorage:', error);
            return false;
        }
    },
    
    /**
     * Limpia todos los datos de la aplicación en localStorage
     */
    clearAppStorage: function() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('mct_')) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('Error limpiando localStorage:', error);
            return false;
        }
    },
    
    // ========== MANEJO DE FORMULARIOS ==========
    
    /**
     * Valida un formulario basado en reglas definidas
     * @param {HTMLFormElement} form - Formulario a validar
     * @param {Object} rules - Reglas de validación
     * @returns {Object} Resultado de validación
     */
    validateForm: function(form, rules = {}) {
        const errors = {};
        let isValid = true;
        
        // Validar cada campo
        Object.keys(rules).forEach(fieldName => {
            const field = form.elements[fieldName];
            if (!field) return;
            
            const value = field.value.trim();
            const fieldRules = rules[fieldName];
            
            // Validar campo requerido
            if (fieldRules.required && !value) {
                errors[fieldName] = fieldRules.requiredMessage || 'Este campo es requerido';
                isValid = false;
                return;
            }
            
            // Validar email
            if (fieldRules.email && value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errors[fieldName] = fieldRules.emailMessage || 'Email inválido';
                    isValid = false;
                    return;
                }
            }
            
            // Validar teléfono
            if (fieldRules.phone && value) {
                const phoneRegex = /^[+]?[\d\s\-()]{8,}$/;
                if (!phoneRegex.test(value.replace(/\s/g, ''))) {
                    errors[fieldName] = fieldRules.phoneMessage || 'Teléfono inválido';
                    isValid = false;
                    return;
                }
            }
            
            // Validar longitud mínima
            if (fieldRules.minLength && value.length < fieldRules.minLength) {
                errors[fieldName] = fieldRules.minLengthMessage || 
                    `Mínimo ${fieldRules.minLength} caracteres`;
                isValid = false;
                return;
            }
            
            // Validar longitud máxima
            if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
                errors[fieldName] = fieldRules.maxLengthMessage || 
                    `Máximo ${fieldRules.maxLength} caracteres`;
                isValid = false;
                return;
            }
            
            // Validar patrón personalizado
            if (fieldRules.pattern && value) {
                const regex = new RegExp(fieldRules.pattern);
                if (!regex.test(value)) {
                    errors[fieldName] = fieldRules.patternMessage || 'Formato inválido';
                    isValid = false;
                    return;
                }
            }
        });
        
        return {
            isValid,
            errors,
            firstError: Object.keys(errors).length > 0 ? errors[Object.keys(errors)[0]] : null
        };
    },
    
    /**
     * Serializa un formulario a objeto
     * @param {HTMLFormElement} form - Formulario a serializar
     * @returns {Object} Datos del formulario
     */
    serializeForm: function(form) {
        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            // Si el campo ya existe (como arrays), convertir a array
            if (data[key] !== undefined) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        
        return data;
    },
    
    /**
     * Rellena un formulario con datos
     * @param {HTMLFormElement} form - Formulario a rellenar
     * @param {Object} data - Datos para rellenar
     */
    populateForm: function(form, data) {
        Object.keys(data).forEach(key => {
            const field = form.elements[key];
            if (!field) return;
            
            if (field.type === 'checkbox' || field.type === 'radio') {
                if (Array.isArray(data[key])) {
                    // Para checkboxes múltiples
                    field.forEach(input => {
                        input.checked = data[key].includes(input.value);
                    });
                } else {
                    field.checked = field.value === data[key];
                }
            } else if (field.type === 'select-multiple') {
                // Para selects múltiples
                const values = Array.isArray(data[key]) ? data[key] : [data[key]];
                Array.from(field.options).forEach(option => {
                    option.selected = values.includes(option.value);
                });
            } else {
                field.value = data[key] || '';
            }
        });
    },
    
    // ========== MANEJO DE FECHAS ==========
    
    /**
     * Formatea una fecha en formato legible
     * @param {Date|string} date - Fecha a formatear
     * @param {string} format - Formato deseado
     * @returns {string} Fecha formateada
     */
    formatDate: function(date, format = 'dd/mm/yyyy') {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        
        const formats = {
            'dd/mm/yyyy': `${day}/${month}/${year}`,
            'mm/dd/yyyy': `${month}/${day}/${year}`,
            'yyyy-mm-dd': `${year}-${month}-${day}`,
            'dd-mm-yyyy': `${day}-${month}-${year}`,
            'full': `${day}/${month}/${year} ${hours}:${minutes}`,
            'relative': this.getRelativeTime(d)
        };
        
        return formats[format] || formats['dd/mm/yyyy'];
    },
    
    /**
     * Obtiene tiempo relativo (hace X tiempo)
     * @param {Date} date - Fecha de referencia
     * @returns {string} Tiempo relativo
     */
    getRelativeTime: function(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        
        if (diffSec < 60) return 'hace unos segundos';
        if (diffMin < 60) return `hace ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
        if (diffHour < 24) return `hace ${diffHour} hora${diffHour > 1 ? 's' : ''}`;
        if (diffDay < 7) return `hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;
        
        return this.formatDate(date, 'dd/mm/yyyy');
    },
    
    /**
     * Suma días a una fecha
     * @param {Date} date - Fecha base
     * @param {number} days - Días a sumar
     * @returns {Date} Nueva fecha
     */
    addDays: function(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    },
    
    /**
     * Calcula diferencia entre fechas
     * @param {Date} date1 - Fecha inicial
     * @param {Date} date2 - Fecha final
     * @param {string} unit - Unidad de retorno (days, hours, minutes)
     * @returns {number} Diferencia
     */
    dateDiff: function(date1, date2, unit = 'days') {
        const diffMs = Math.abs(date2 - date1);
        
        switch (unit) {
            case 'minutes':
                return Math.floor(diffMs / (1000 * 60));
            case 'hours':
                return Math.floor(diffMs / (1000 * 60 * 60));
            case 'days':
            default:
                return Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
    },
    
    // ========== MANEJO DE STRINGS ==========
    
    /**
     * Capitaliza la primera letra de un string
     * @param {string} str - String a capitalizar
     * @returns {string} String capitalizado
     */
    capitalize: function(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },
    
    /**
     * Convierte texto a slug (URL amigable)
     * @param {string} text - Texto a convertir
     * @returns {string} Slug
     */
    slugify: function(text) {
        return text
            .toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim();
    },
    
    /**
     * Trunca un texto a una longitud máxima
     * @param {string} text - Texto a truncar
     * @param {number} maxLength - Longitud máxima
     * @param {string} suffix - Sufijo para texto truncado
     * @returns {string} Texto truncado
     */
    truncate: function(text, maxLength = 100, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substr(0, maxLength).trim() + suffix;
    },
    
    /**
     * Escapa HTML para prevenir XSS
     * @param {string} html - HTML a escapar
     * @returns {string} HTML escapado
     */
    escapeHtml: function(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },
    
    // ========== MANEJO DE NÚMEROS ==========
    
    /**
     * Formatea un número como moneda
     * @param {number} amount - Cantidad
     * @param {string} currency - Código de moneda (PEN, USD, EUR)
     * @param {string} locale - Locale para formateo
     * @returns {string} Moneda formateada
     */
    formatCurrency: function(amount, currency = 'PEN', locale = 'es-PE') {
        if (isNaN(amount)) return '';
        
        const formatter = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        return formatter.format(amount);
    },
    
    /**
     * Formatea un número con separadores de miles
     * @param {number} number - Número a formatear
     * @param {string} locale - Locale para formateo
     * @returns {string} Número formateado
     */
    formatNumber: function(number, locale = 'es-PE') {
        if (isNaN(number)) return '';
        return new Intl.NumberFormat(locale).format(number);
    },
    
    /**
     * Genera un número aleatorio en un rango
     * @param {number} min - Mínimo
     * @param {number} max - Máximo
     * @returns {number} Número aleatorio
     */
    randomNumber: function(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    // ========== MANEJO DE ARRAYS Y OBJETOS ==========
    
    /**
     * Elimina duplicados de un array
     * @param {Array} array - Array a limpiar
     * @returns {Array} Array sin duplicados
     */
    uniqueArray: function(array) {
        return [...new Set(array)];
    },
    
    /**
     * Ordena un array de objetos por propiedad
     * @param {Array} array - Array a ordenar
     * @param {string} prop - Propiedad para ordenar
     * @param {boolean} ascending - Orden ascendente
     * @returns {Array} Array ordenado
     */
    sortBy: function(array, prop, ascending = true) {
        return array.sort((a, b) => {
            let aVal = a[prop];
            let bVal = b[prop];
            
            // Manejar strings
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (aVal < bVal) return ascending ? -1 : 1;
            if (aVal > bVal) return ascending ? 1 : -1;
            return 0;
        });
    },
    
    /**
     * Agrupa un array por propiedad
     * @param {Array} array - Array a agrupar
     * @param {string} prop - Propiedad para agrupar
     * @returns {Object} Objeto con grupos
     */
    groupBy: function(array, prop) {
        return array.reduce((groups, item) => {
            const key = item[prop];
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
            return groups;
        }, {});
    },
    
    /**
     * Fusiona dos objetos profundamente
     * @param {Object} target - Objeto destino
     * @param {Object} source - Objeto fuente
     * @returns {Object} Objeto fusionado
     */
    deepMerge: function(target, source) {
        const output = Object.assign({}, target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    },
    
    /**
     * Verifica si un valor es un objeto
     * @param {any} item - Valor a verificar
     * @returns {boolean} True si es objeto
     */
    isObject: function(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },
    
    // ========== MANEJO DE DOM ==========
    
    /**
     * Obtiene parámetros de la URL
     * @returns {Object} Parámetros de URL
     */
    getUrlParams: function() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const regex = /([^&=]+)=([^&]*)/g;
        let match;
        
        while ((match = regex.exec(queryString))) {
            params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
        }
        
        return params;
    },
    
    /**
     * Actualiza parámetros en la URL sin recargar
     * @param {Object} params - Parámetros a actualizar
     * @param {string} url - URL base (opcional)
     */
    updateUrlParams: function(params, url = window.location.href) {
        const urlObj = new URL(url);
        
        Object.keys(params).forEach(key => {
            if (params[key] === null || params[key] === undefined) {
                urlObj.searchParams.delete(key);
            } else {
                urlObj.searchParams.set(key, params[key]);
            }
        });
        
        window.history.replaceState({}, '', urlObj.toString());
    },
    
    /**
     * Copia texto al portapapeles
     * @param {string} text - Texto a copiar
     * @returns {Promise<boolean>} True si se copió exitosamente
     */
    copyToClipboard: async function(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback para navegadores antiguos
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            } catch (fallbackError) {
                console.error('Error copiando al portapapeles:', fallbackError);
                return false;
            }
        }
    },
    
    /**
     * Desplaza suavemente a un elemento
     * @param {string|HTMLElement} target - Elemento destino
     * @param {Object} options - Opciones de scroll
     */
    smoothScrollTo: function(target, options = {}) {
        const defaultOptions = {
            offset: 0,
            duration: 800,
            easing: 'easeInOutCubic'
        };
        
        const config = { ...defaultOptions, ...options };
        const element = typeof target === 'string' ? 
            document.querySelector(target) : target;
        
        if (!element) return;
        
        const startPosition = window.pageYOffset;
        const targetPosition = element.getBoundingClientRect().top + 
                              window.pageYOffset - config.offset;
        const distance = targetPosition - startPosition;
        const startTime = performance.now();
        
        // Funciones de easing
        const easingFunctions = {
            linear: t => t,
            easeInOutCubic: t => t < 0.5 ? 
                4 * t * t * t : 
                1 - Math.pow(-2 * t + 2, 3) / 2
        };
        
        const easingFunc = easingFunctions[config.easing] || easingFunctions.easeInOutCubic;
        
        function scrollStep(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / config.duration, 1);
            const easedProgress = easingFunc(progress);
            
            window.scrollTo(0, startPosition + (distance * easedProgress));
            
            if (progress < 1) {
                requestAnimationFrame(scrollStep);
            }
        }
        
        requestAnimationFrame(scrollStep);
    },
    
    /**
     * Verifica si un elemento está en viewport
     * @param {HTMLElement} element - Elemento a verificar
     * @param {number} threshold - Umbral de visibilidad (0-1)
     * @returns {boolean} True si está visible
     */
    isInViewport: function(element, threshold = 0) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        
        const verticalVisible = (
            rect.top <= windowHeight * (1 - threshold) &&
            rect.bottom >= windowHeight * threshold
        );
        
        const horizontalVisible = (
            rect.left <= windowWidth * (1 - threshold) &&
            rect.right >= windowWidth * threshold
        );
        
        return verticalVisible && horizontalVisible;
    },
    
    // ========== NOTIFICACIONES Y MENSAJES ==========
    
    /**
     * Muestra una notificación toast
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de notificación (success, error, warning, info)
     * @param {number} duration - Duración en milisegundos
     */
    showToast: function(message, type = 'info', duration = 5000) {
        // Crear contenedor si no existe
        let container = document.getElementById('mct-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mct-toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(container);
        }
        
        // Crear toast
        const toast = document.createElement('div');
        toast.className = `mct-toast mct-toast-${type}`;
        toast.style.cssText = `
            background: ${this.getToastColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease-out;
            max-width: 350px;
        `;
        
        // Icono según tipo
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="mct-toast-close" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                margin-left: auto;
                opacity: 0.7;
                transition: opacity 0.2s;
            ">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Botón cerrar
        const closeBtn = toast.querySelector('.mct-toast-close');
        closeBtn.addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        // Auto-remover
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
        
        return toast;
    },
    
    /**
     * Obtiene color para toast según tipo
     * @param {string} type - Tipo de toast
     * @returns {string} Color CSS
     */
    getToastColor: function(type) {
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[type] || colors.info;
    },
    
    /**
     * Elimina un toast con animación
     * @param {HTMLElement} toast - Elemento toast
     */
    removeToast: function(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    },
    
    // ========== VALIDACIONES ESPECÍFICAS ==========
    
    /**
     * Valida un DNI peruano
     * @param {string} dni - DNI a validar
     * @returns {boolean} True si es válido
     */
    validateDNI: function(dni) {
        if (!dni || dni.length !== 8) return false;
        
        const dniRegex = /^[0-9]{8}$/;
        if (!dniRegex.test(dni)) return false;
        
        // Aquí podrías agregar validación del dígito verificador
        // (algoritmo específico para DNI peruano)
        
        return true;
    },
    
    /**
     * Valida un RUC peruano
     * @param {string} ruc - RUC a validar
     * @returns {boolean} True si es válido
     */
    validateRUC: function(ruc) {
        if (!ruc || ruc.length !== 11) return false;
        
        const rucRegex = /^[0-9]{11}$/;
        if (!rucRegex.test(ruc)) return false;
        
        // Validación básica de formato RUC peruano
        const tipo = ruc.substring(0, 2);
        const validTypes = ['10', '15', '17', '20'];
        
        if (!validTypes.includes(tipo)) return false;
        
        // Aquí podrías agregar validación del dígito verificador
        
        return true;
    },
    
    // ========== HELPERS PARA DEPURACIÓN ==========
    
    /**
     * Registra mensajes de depuración solo en desarrollo
     * @param {string} message - Mensaje a registrar
     * @param {any} data - Datos adicionales
     * @param {string} level - Nivel de log (log, warn, error)
     */
    debug: function(message, data = null, level = 'log') {
        // Solo en desarrollo (no en producción)
        if (window.location.hostname !== 'localhost' && 
            !window.location.hostname.includes('127.0.0.1')) {
            return;
        }
        
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const prefix = `[${timestamp}] MCT:`;
        
        if (data) {
            console[level](prefix, message, data);
        } else {
            console[level](prefix, message);
        }
    },
    
    /**
     * Mide el tiempo de ejecución de una función
     * @param {Function} fn - Función a medir
     * @param {string} label - Etiqueta para el log
     * @returns {any} Resultado de la función
     */
    measurePerformance: function(fn, label = 'Function') {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        this.debug(`${label} took ${(end - start).toFixed(2)}ms`);
        return result;
    }
};

// Añadir animaciones CSS para toasts si no existen
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('#mct-toast-animations')) {
        const style = document.createElement('style');
        style.id = 'mct-toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    console.log('✅ MyCuscoTrip Utils cargado');
});

// Hacer disponible globalmente
window.MyCuscoTripUtils = MyCuscoTripUtils;

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyCuscoTripUtils;
}
