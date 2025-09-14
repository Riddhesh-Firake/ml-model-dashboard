/**
 * EventManager - Centralized event management system for CSP compliance
 * Provides event delegation, cleanup, and memory management
 */
class EventManager {
    constructor() {
        this.listeners = new Map();
        this.delegatedEvents = new Map();
        this.boundCleanup = this.cleanup.bind(this);
        
        // Auto-cleanup on page unload
        window.addEventListener('beforeunload', this.boundCleanup);
        window.addEventListener('pagehide', this.boundCleanup);
    }

    /**
     * Add event listener with automatic cleanup tracking
     * @param {Element|string} element - DOM element or CSS selector
     * @param {string} event - Event type (e.g., 'click', 'submit')
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     * @returns {string} - Unique listener ID for removal
     */
    addEventListener(element, event, handler, options = {}) {
        const targetElement = typeof element === 'string' ? 
            document.querySelector(element) : element;
            
        if (!targetElement) {
            console.warn(`EventManager: Element not found for selector: ${element}`);
            return null;
        }

        const listenerId = this.generateListenerId();
        const listenerData = {
            element: targetElement,
            event,
            handler,
            options,
            id: listenerId
        };

        // Store listener for cleanup
        this.listeners.set(listenerId, listenerData);

        // Add the actual event listener
        targetElement.addEventListener(event, handler, options);

        return listenerId;
    }

    /**
     * Remove specific event listener
     * @param {string} listenerId - ID returned from addEventListener
     */
    removeEventListener(listenerId) {
        const listenerData = this.listeners.get(listenerId);
        if (!listenerData) {
            console.warn(`EventManager: Listener not found: ${listenerId}`);
            return false;
        }

        const { element, event, handler, options } = listenerData;
        element.removeEventListener(event, handler, options);
        this.listeners.delete(listenerId);
        
        return true;
    }

    /**
     * Set up event delegation for dynamic content
     * @param {Element|string} container - Container element or CSS selector
     * @param {string} selector - CSS selector for target elements
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @param {Object} options - Event listener options
     * @returns {string} - Unique delegation ID for removal
     */
    delegateEvent(container, selector, event, handler, options = {}) {
        const containerElement = typeof container === 'string' ? 
            document.querySelector(container) : container;
            
        if (!containerElement) {
            console.warn(`EventManager: Container not found for selector: ${container}`);
            return null;
        }

        const delegationId = this.generateListenerId();
        
        // Create delegated handler
        const delegatedHandler = (e) => {
            const target = e.target.closest(selector);
            if (target && containerElement.contains(target)) {
                // Call original handler with modified event context
                const delegatedEvent = Object.create(e);
                delegatedEvent.delegatedTarget = target;
                handler.call(target, delegatedEvent);
            }
        };

        const delegationData = {
            container: containerElement,
            selector,
            event,
            originalHandler: handler,
            delegatedHandler,
            options,
            id: delegationId
        };

        // Store delegation for cleanup
        this.delegatedEvents.set(delegationId, delegationData);

        // Add delegated event listener to container
        containerElement.addEventListener(event, delegatedHandler, options);

        return delegationId;
    }

    /**
     * Remove delegated event listener
     * @param {string} delegationId - ID returned from delegateEvent
     */
    removeDelegatedEvent(delegationId) {
        const delegationData = this.delegatedEvents.get(delegationId);
        if (!delegationData) {
            console.warn(`EventManager: Delegated event not found: ${delegationId}`);
            return false;
        }

        const { container, event, delegatedHandler, options } = delegationData;
        container.removeEventListener(event, delegatedHandler, options);
        this.delegatedEvents.delete(delegationId);
        
        return true;
    }

    /**
     * Add multiple event listeners at once
     * @param {Array} eventConfigs - Array of event configuration objects
     * @returns {Array} - Array of listener IDs
     */
    addEventListeners(eventConfigs) {
        return eventConfigs.map(config => {
            const { element, event, handler, options } = config;
            return this.addEventListener(element, event, handler, options);
        }).filter(id => id !== null);
    }

    /**
     * Remove multiple event listeners at once
     * @param {Array} listenerIds - Array of listener IDs
     */
    removeEventListeners(listenerIds) {
        listenerIds.forEach(id => this.removeEventListener(id));
    }

    /**
     * Get all active listeners (for debugging)
     * @returns {Object} - Object containing listeners and delegated events
     */
    getActiveListeners() {
        return {
            listeners: Array.from(this.listeners.values()),
            delegatedEvents: Array.from(this.delegatedEvents.values())
        };
    }

    /**
     * Check if element has event listeners managed by this instance
     * @param {Element} element - DOM element to check
     * @returns {Array} - Array of listener data for the element
     */
    getListenersForElement(element) {
        return Array.from(this.listeners.values())
            .filter(listener => listener.element === element);
    }

    /**
     * Clean up all event listeners and delegated events
     * Called automatically on page unload
     */
    cleanup() {
        // Remove all regular event listeners
        for (const [id, listenerData] of this.listeners) {
            const { element, event, handler, options } = listenerData;
            try {
                element.removeEventListener(event, handler, options);
            } catch (error) {
                console.warn(`EventManager: Error removing listener ${id}:`, error);
            }
        }

        // Remove all delegated event listeners
        for (const [id, delegationData] of this.delegatedEvents) {
            const { container, event, delegatedHandler, options } = delegationData;
            try {
                container.removeEventListener(event, delegatedHandler, options);
            } catch (error) {
                console.warn(`EventManager: Error removing delegated event ${id}:`, error);
            }
        }

        // Clear all stored references
        this.listeners.clear();
        this.delegatedEvents.clear();

        console.log('EventManager: All event listeners cleaned up');
    }

    /**
     * Destroy the event manager and clean up
     */
    destroy() {
        this.cleanup();
        
        // Remove auto-cleanup listeners
        window.removeEventListener('beforeunload', this.boundCleanup);
        window.removeEventListener('pagehide', this.boundCleanup);
    }

    /**
     * Generate unique listener ID
     * @returns {string} - Unique identifier
     */
    generateListenerId() {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Batch operations for performance
     */
    batch(operations) {
        const results = [];
        
        operations.forEach(operation => {
            try {
                switch (operation.type) {
                    case 'addEventListener':
                        results.push(this.addEventListener(
                            operation.element,
                            operation.event,
                            operation.handler,
                            operation.options
                        ));
                        break;
                    case 'delegateEvent':
                        results.push(this.delegateEvent(
                            operation.container,
                            operation.selector,
                            operation.event,
                            operation.handler,
                            operation.options
                        ));
                        break;
                    case 'removeEventListener':
                        results.push(this.removeEventListener(operation.id));
                        break;
                    case 'removeDelegatedEvent':
                        results.push(this.removeDelegatedEvent(operation.id));
                        break;
                    default:
                        console.warn(`EventManager: Unknown batch operation: ${operation.type}`);
                        results.push(null);
                }
            } catch (error) {
                console.error(`EventManager: Error in batch operation:`, error);
                results.push(null);
            }
        });

        return results;
    }

    /**
     * Add passive event listeners for better performance
     * @param {Element|string} element - DOM element or CSS selector
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @returns {string} - Listener ID
     */
    addPassiveListener(element, event, handler) {
        return this.addEventListener(element, event, handler, { passive: true });
    }

    /**
     * Add one-time event listener that auto-removes after first trigger
     * @param {Element|string} element - DOM element or CSS selector
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function
     * @returns {string} - Listener ID
     */
    addOnceListener(element, event, handler) {
        const onceHandler = (e) => {
            handler(e);
            this.removeEventListener(listenerId);
        };
        
        const listenerId = this.addEventListener(element, event, onceHandler);
        return listenerId;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventManager;
} else {
    window.EventManager = EventManager;
}