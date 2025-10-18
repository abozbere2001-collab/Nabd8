
type LogLevel = 'log' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: Date;
  message: string;
  extra: any[];
}

const MAX_LOGS = 200;

class LoggerService {
  private logs: LogEntry[] = [];
  private originalConsole: { [key in LogLevel]: (...args: any[]) => void };

  constructor() {
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    this.hijackConsole();
  }

  private hijackConsole() {
    (Object.keys(this.originalConsole) as LogLevel[]).forEach(level => {
      const originalMethod = this.originalConsole[level];
      (console as any)[level] = (...args: any[]) => {
        this.addLog(level, args);
        originalMethod(...args);
      };
    });
  }

  private addLog(level: LogLevel, args: any[]) {
    if (this.logs.length >= MAX_LOGS) {
      this.logs.shift(); // Remove the oldest log
    }
    
    let message = '';
    const extra: any[] = [];
    
    if (args.length > 0) {
        if (typeof args[0] === 'string') {
            message = args[0];
            extra.push(...args.slice(1));
        } else {
            message = 'Non-string log argument';
            extra.push(...args);
        }
    }

    this.logs.push({
      level,
      timestamp: new Date(),
      message,
      extra,
    });
  }

  public getFormattedLogs(): string {
    return this.logs
      .map(entry => {
        const time = entry.timestamp.toLocaleTimeString();
        const level = entry.level.toUpperCase();
        let extraString = '';
        if (entry.extra.length > 0) {
          try {
            extraString = entry.extra.map(e => JSON.stringify(e, null, 2)).join(' ');
          } catch {
            extraString = '[Unserializable object]';
          }
        }
        return `[${time}] [${level}] ${entry.message} ${extraString}`;
      })
      .join('\n');
  }

  public clearLogs() {
    this.logs = [];
  }
}

// Create a singleton instance
export const logger = new LoggerService();
