/**
 * Servicio de monitoreo de Rate Limits de WhatsApp Business API
 *
 * Meta limita a 5,000 llamadas por hora para WABA activos
 * Este servicio monitorea el uso en tiempo real y genera alertas
 */

class RateLimitMonitor {
  constructor() {
    // Almacena timestamps de llamadas API en la última hora
    this.apiCalls = [];
    this.LIMIT_PER_HOUR = 5000;
    this.ALERT_THRESHOLD = 0.7; // 70% del límite
    this.alertSent = false;

    // Estadísticas acumuladas (reinician cada hora)
    this.stats = {
      currentHour: new Date().getHours(),
      totalCalls: 0,
      sendMessageCalls: 0,
      mediaDownloadCalls: 0,
      otherCalls: 0,
      peakCallsPerMinute: 0,
      lastReset: new Date()
    };

    // Limpieza automática cada minuto
    setInterval(() => this.cleanup(), 60000);

    // Reinicio de estadísticas cada hora
    setInterval(() => this.resetHourlyStats(), 3600000);
  }

  /**
   * Registrar una llamada a la API
   * @param {string} endpoint - Tipo de llamada (send_message, media_download, etc.)
   */
  trackCall(endpoint = 'other') {
    const now = Date.now();
    this.apiCalls.push({ timestamp: now, endpoint });

    // Actualizar estadísticas
    this.stats.totalCalls++;

    if (endpoint === 'send_message') {
      this.stats.sendMessageCalls++;
    } else if (endpoint === 'media_download') {
      this.stats.mediaDownloadCalls++;
    } else {
      this.stats.otherCalls++;
    }

    // Calcular pico de llamadas por minuto
    const lastMinuteCalls = this.getCallsInLastMinutes(1);
    if (lastMinuteCalls > this.stats.peakCallsPerMinute) {
      this.stats.peakCallsPerMinute = lastMinuteCalls;
    }

    // Verificar si se debe enviar alerta
    this.checkAlert();
  }

  /**
   * Limpia llamadas antiguas (más de 1 hora)
   */
  cleanup() {
    const oneHourAgo = Date.now() - 3600000;
    this.apiCalls = this.apiCalls.filter(call => call.timestamp > oneHourAgo);
  }

  /**
   * Obtiene el número de llamadas en la última hora
   */
  getCallsInLastHour() {
    const oneHourAgo = Date.now() - 3600000;
    return this.apiCalls.filter(call => call.timestamp > oneHourAgo).length;
  }

  /**
   * Obtiene el número de llamadas en los últimos N minutos
   */
  getCallsInLastMinutes(minutes) {
    const timeAgo = Date.now() - (minutes * 60000);
    return this.apiCalls.filter(call => call.timestamp > timeAgo).length;
  }

  /**
   * Obtiene el porcentaje de uso del límite
   */
  getUsagePercentage() {
    const calls = this.getCallsInLastHour();
    return (calls / this.LIMIT_PER_HOUR) * 100;
  }

  /**
   * Verifica si se debe enviar alerta
   */
  checkAlert() {
    const usage = this.getUsagePercentage();

    if (usage >= (this.ALERT_THRESHOLD * 100) && !this.alertSent) {
      this.alertSent = true;
      console.error(`🚨 ALERTA: Uso de API al ${usage.toFixed(1)}% (${this.getCallsInLastHour()}/${this.LIMIT_PER_HOUR} calls/hora)`);

      // Emitir evento para enviar al panel
      if (global.io) {
        global.io.emit('rate_limit_alert', {
          usage: usage.toFixed(1),
          calls: this.getCallsInLastHour(),
          limit: this.LIMIT_PER_HOUR,
          timestamp: new Date()
        });
      }
    } else if (usage < (this.ALERT_THRESHOLD * 100)) {
      // Resetear alerta si baja del umbral
      this.alertSent = false;
    }
  }

  /**
   * Reinicia estadísticas cada hora
   */
  resetHourlyStats() {
    const currentHour = new Date().getHours();

    if (currentHour !== this.stats.currentHour) {
      console.log(`📊 Estadísticas de la hora ${this.stats.currentHour}:00 - Total: ${this.stats.totalCalls} llamadas (Envíos: ${this.stats.sendMessageCalls}, Descargas: ${this.stats.mediaDownloadCalls}, Pico: ${this.stats.peakCallsPerMinute} calls/min)`);

      this.stats = {
        currentHour: currentHour,
        totalCalls: 0,
        sendMessageCalls: 0,
        mediaDownloadCalls: 0,
        otherCalls: 0,
        peakCallsPerMinute: 0,
        lastReset: new Date()
      };
    }
  }

  /**
   * Obtiene estadísticas detalladas
   */
  getStats() {
    const callsLastHour = this.getCallsInLastHour();
    const callsLast5Min = this.getCallsInLastMinutes(5);
    const callsLast1Min = this.getCallsInLastMinutes(1);
    const usage = this.getUsagePercentage();

    return {
      limit: this.LIMIT_PER_HOUR,
      callsLastHour: callsLastHour,
      callsLast5Minutes: callsLast5Min,
      callsLastMinute: callsLast1Min,
      usagePercentage: parseFloat(usage.toFixed(2)),
      remainingCalls: this.LIMIT_PER_HOUR - callsLastHour,
      alertThreshold: this.ALERT_THRESHOLD * 100,
      isNearLimit: usage >= (this.ALERT_THRESHOLD * 100),
      hourlyStats: {
        ...this.stats,
        currentHour: `${this.stats.currentHour}:00 - ${(this.stats.currentHour + 1) % 24}:00`
      },
      projectedHourlyCalls: callsLast5Min * 12, // Proyección basada en últimos 5 min
      timestamp: new Date()
    };
  }

  /**
   * Verifica si se puede hacer una llamada (para implementar cola si es necesario)
   */
  canMakeCall() {
    return this.getCallsInLastHour() < this.LIMIT_PER_HOUR;
  }

  /**
   * Obtiene el tiempo estimado de espera si se alcanzó el límite
   */
  getEstimatedWaitTime() {
    if (this.canMakeCall()) return 0;

    // Encontrar la llamada más antigua y calcular cuándo se liberará
    const oldestCall = this.apiCalls[0];
    if (!oldestCall) return 0;

    const oneHourFromOldest = oldestCall.timestamp + 3600000;
    const waitTime = oneHourFromOldest - Date.now();

    return Math.max(0, waitTime);
  }
}

// Singleton instance
const rateLimitMonitor = new RateLimitMonitor();

module.exports = rateLimitMonitor;
