import fs from 'fs'
import path from 'path'
import type { LogObject } from 'consola'
import { createConsola } from 'consola'

const logDir = path.join(process.cwd(), 'data', 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logFilePath = path.join(logDir, 'app.log')

const logFileReporter = {
  log: (logObj: LogObject) => {
    const logLine = `${JSON.stringify(logObj)}\n`
    fs.appendFile(logFilePath, logLine, (err) => {
      if (err) {
        console.error('Failed to write log to file:', err)
      }
    })
  },
}

const mConsola = createConsola({
  formatOptions: {
    date: true,
    colors: true,
    compact: false,
  },
})

mConsola.addReporter(logFileReporter)

export const logger = {
  app: mConsola.withTag('lumamemo/main'),
  storage: mConsola.withTag('lumamemo/storage'),
  fs: mConsola.withTag('lumamemo/fs'),
  image: mConsola.withTag('lumamemo/image'),
  location: mConsola.withTag('lumamemo/location'),
  dynamic: (id: string) => mConsola.withTag(`lumamemo/${id}`),
}

export type Logger = Omit<typeof logger, 'dynamic'>
export type DynamicLogger = typeof logger.dynamic
