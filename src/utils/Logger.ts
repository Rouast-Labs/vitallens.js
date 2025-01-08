/**
 * Utility class for logging debug and informational messages.
 * Provides methods for different log levels.
 */
export class Logger {
  private static isDebug: boolean = false;

  /**
   * Enables or disables debug logging.
   * @param debug - Whether to enable debug mode.
   */
  static setDebug(debug: boolean): void {
    this.isDebug = debug;
  }

  /**
   * Logs an informational message.
   * @param message - The message to log.
   */
  static info(message: string): void {
    console.log(`[INFO]: ${message}`);
  }

  /**
   * Logs a debug message (only if debug mode is enabled).
   * @param message - The message to log.
   */
  static debug(message: string): void {
    if (this.isDebug) {
      console.debug(`[DEBUG]: ${message}`);
    }
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   */
  static warn(message: string): void {
    console.warn(`[WARN]: ${message}`);
  }

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param error - Optional error object for additional context.
   */
  static error(message: string, error?: Error): void {
    console.error(`[ERROR]: ${message}`);
    if (error) {
      console.error(error.stack);
    }
  }
}
