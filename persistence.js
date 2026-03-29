const { MongoClient, ObjectId } = require("mongodb");

const url = "mongodb://localhost:27017/";
const client = new MongoClient(url);

let database;

/**
 * Connect DB
 */
async function connect() {
    await client.connect();
    database = client.db("assignment4");
}

/**
 * Employees
 */
async function getAllEmployees() {
    return await database.collection("employees").find().toArray();
}

async function getEmployeeById(employeeId) {
    return await database.collection("employees")
        .findOne({ _id: new ObjectId(employeeId) });
}

async function updateEmployee(employeeId, name, phone) {
    await database.collection("employees").updateOne(
        { _id: new ObjectId(employeeId) },
        { $set: { name: name, phone: phone } }
    );
}

/**
 * Shifts
 */
async function getAllShifts() {
    return await database.collection("shifts").find().toArray();
}

/**
 * Users
 */
async function insertUser(email, password, type) {
    await database.collection("users").insertOne({
        email: email,
        password: password,
        type: type
    });
}

async function getUserByEmail(email) {
    return await database.collection("users").findOne({ email: email });
}

/**
 * Sessions
 */
async function createSession(email, type) {

    const sessionId = Math.random().toString();
    const expiry = Date.now() + (5 * 60 * 1000);

    await database.collection("sessions").insertOne({
        sessionId: sessionId,
        email: email,
        type: type,
        expiry: expiry
    });

    return sessionId;
}

async function getSession(sessionId) {
    return await database.collection("sessions")
        .findOne({ sessionId: sessionId });
}

async function deleteSession(sessionId) {
    await database.collection("sessions")
        .deleteOne({ sessionId: sessionId });
}

async function extendSession(sessionId) {
    const expiry = Date.now() + (5 * 60 * 1000);

    await database.collection("sessions").updateOne(
        { sessionId: sessionId },
        { $set: { expiry: expiry } }
    );
}

/**
 * Security Log
 */
async function insertLog(email, url, method) {
    await database.collection("security_log").insertOne({
        timestamp: new Date(),
        email: email,
        url: url,
        method: method
    });
}

module.exports = {
    connect,
    getAllEmployees,
    getEmployeeById,
    updateEmployee,
    getAllShifts,
    insertUser,
    getUserByEmail,
    createSession,
    getSession,
    deleteSession,
    extendSession,
    insertLog
};