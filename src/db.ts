import { MongoClient, Db } from "mongodb";
const uri=process.env.MONGODB_URI;
if(!uri) throw new Error("MONGODB_URI is required");
const client=new MongoClient(uri);
let database:Db;
export async function connectDB(){await client.connect();database=client.db(process.env.DB_NAME||"booknook");await database.collection("books").createIndex({addedAt:-1});await database.collection("borrows").createIndex({userEmail:1,bookId:1,active:1});console.log("MongoDB connected");}
export function getDB(){if(!database)throw new Error("Database is not connected");return database;}
