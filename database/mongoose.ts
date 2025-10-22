import mongoose from 'mongoose'
const MONGODB_URI = process.env.MONGODB_URI;


declare global {
  // Extends Node global to cache the Mongoose connection across hot reloads
  // in Next.js (app router), preventing multiple connections in dev.
  // Do not inline comments in codebase per repo guidelines.
  // Types kept minimal and consistent with existing style.
  // eslint-disable-next-line no-var
  var mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined
}

let cached = global.mongooseCache
if (!cached) {
  cached = { conn: null, promise: null }
  global.mongooseCache = cached
}

export const connectToDatabase = async () => {
  if (!MONGODB_URI) throw new Error('MONGODB_URI must be set in .env')

  if (cached!.conn) return cached!.conn

  if (!cached!.promise) {
    cached!.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false })
  }
  try {
    cached!.conn = await cached!.promise
  } catch (error) {
    cached!.promise = null
    throw error
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Connected to MongoDB (${process.env.NODE_ENV})`)
  }
  return cached!.conn
}
