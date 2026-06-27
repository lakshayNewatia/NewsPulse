import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db(process.env.MONGODB_DB || "newspulse");
  }
  return db;
}
