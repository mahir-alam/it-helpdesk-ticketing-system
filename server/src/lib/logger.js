const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'test' ? LEVELS.warn : LEVELS.info);

function emit(level, args) {
  if (LEVELS[level] > activeLevel) return;
  const stamp = new Date().toISOString();
  const line = `${stamp} [${level.toUpperCase()}]`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

export const logger = {
  error: (...args) => emit('error', args),
  warn: (...args) => emit('warn', args),
  info: (...args) => emit('info', args),
  debug: (...args) => emit('debug', args),
};
