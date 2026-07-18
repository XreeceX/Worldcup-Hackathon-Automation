// Plain-console logger with ISO timestamps and level prefixes.

function ts() {
  return new Date().toISOString();
}

function fmt(args) {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

export const log = {
  info: (...args) => console.log(`${ts()} [INFO]  ${fmt(args)}`),
  warn: (...args) => console.warn(`${ts()} [WARN]  ${fmt(args)}`),
  error: (...args) => console.error(`${ts()} [ERROR] ${fmt(args)}`),
};
