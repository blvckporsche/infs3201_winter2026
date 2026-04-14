const fs = require('fs/promises')
const mongodb = require('mongodb')
const crypto = require('crypto')
const path = require('path')

let cachedClient = undefined
let cachedDb = undefined

async function getDatabase() {
    if (cachedClient) {
        return cachedDb
    }

    cachedClient = new mongodb.MongoClient('mongodb://moeez:1234@ac-qvyi7dw-shard-00-00.whturh9.mongodb.net:27017,ac-qvyi7dw-shard-00-01.whturh9.mongodb.net:27017,ac-qvyi7dw-shard-00-02.whturh9.mongodb.net:27017/?ssl=true&replicaSet=atlas-b53uni-shard-0&authSource=admin&appName=Cluster0')
    await cachedClient.connect()
    cachedDb = cachedClient.db('infs3201_winter2026')
    return cachedDb
}

async function disconnectDatabase() {
    if (!cachedClient) {
        return
    }
    await cachedClient.close()
}

/**
 * Return a list of all employees loaded from the storage.
 * @returns {Array<{ employeeId: string, name: string, phone: string }>}
 */
async function getAllEmployees() {
    let db = await getDatabase()
    let employeesCollection = db.collection('employees')
    let result = employeesCollection.find()
    return await result.toArray()
}

/**
 * Find a single employee given their MongoDB id.
 * @param {string} empId
 * @returns {{ employeeId: string, name: string, phone: string }|undefined}
 */
async function findEmployee(empId) {
    let db = await getDatabase()
    let employeesCollection = db.collection('employees')
    let result = await employeesCollection.findOne({
        _id: new mongodb.ObjectId(empId)
    })
    return result
}

/**
 * Get a single shift given the shiftId
 * @param {string} shiftId
 * @returns {{shiftId:string, date:string, startTime:string, endTime:string}|undefined}
 */
async function findShift(shiftId) {
    let db = await getDatabase()
    let shiftCollection = db.collection('shifts')
    let shift = await shiftCollection.findOne({ shiftId: shiftId })
    return shift
}

/**
 * Get a list of shifts for an employee.
 * @param {string} empId
 * @returns {Array}
 */
async function getEmployeeShifts(empId) {
    let db = await getDatabase()
    let empObjectId = new mongodb.ObjectId(empId)
    let shiftCollection = db.collection('shifts')

    let shiftDetails = await shiftCollection.find({
        employees: empObjectId
    }).toArray()

    return shiftDetails
}

/**
 * Add a new employee record to the system.
 * @param {{name:string, phone:string}} emp
 */
async function addEmployeeRecord(emp) {
    let db = await getDatabase()
    let employees = db.collection('employees')

    let aggregateResult = await employees.aggregate([
        {
            $project: {
                employeeNum: {
                    $toInt: {
                        $substr: ["$employeeId", 1, -1]
                    }
                }
            }
        },
        {
            $group: {
                _id: null,
                maxEmployeeNum: { $max: "$employeeNum" }
            }
        }
    ]).toArray()

    let maxId = aggregateResult[0].maxEmployeeNum
    emp.employeeId = `E${String(maxId + 1).padStart(3, '0')}`
    await employees.insertOne(emp)
}

async function updateEmployee(empDetails) {
    let db = await getDatabase()
    let employees = db.collection('employees')
    let empMongoId = new mongodb.ObjectId(empDetails.employeeId)

    await employees.updateOne(
        { _id: empMongoId },
        {
            $set: {
                name: empDetails.employeeName,
                phone: empDetails.employeePhone
            }
        }
    )

    return "OK"
}

/**
 * Get one user by username.
 * @param {string} username
 * @returns {Promise<Object|null>}
 */
async function getUserByUsername(username) {
    let db = await getDatabase()
    let users = db.collection('users')

    let result = await users.findOne({
        user: username
    })

    return result
}

/**
 * Check username and password.
 * @param {string} username
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function checkCredentials(username, password) {
    let hashedPassword = crypto.createHash('sha256')
        .update(password)
        .digest('hex')

    let db = await getDatabase()
    let users = db.collection('users')

    let result = await users.findOne({
        user: username,
        password: hashedPassword,
        accountLocked: { $ne: true }
    })

    return result != null
}

/**
 * Increase failed login count for a user.
 * WARNING at 3 attempts, LOCKED at 10 attempts.
 *
 * @param {string} username
 * @returns {Promise<{status:string, attempts:number}>}
 */
async function recordFailedLogin(username) {
    let db = await getDatabase()
    let users = db.collection('users')

    let user = await users.findOne({ user: username })
    if (!user) {
        return { status: "INVALID", attempts: 0 }
    }

    let attempts = 0
    if (user.failedLoginAttempts) {
        attempts = user.failedLoginAttempts
    }

    attempts = attempts + 1

    let accountLocked = false
    if (attempts >= 10) {
        accountLocked = true
    }

    await users.updateOne(
        { user: username },
        {
            $set: {
                failedLoginAttempts: attempts,
                accountLocked: accountLocked
            }
        }
    )

    if (attempts >= 10) {
        return { status: "LOCKED", attempts: attempts }
    }

    if (attempts >= 3) {
        return { status: "WARNING", attempts: attempts }
    }

    return { status: "INVALID", attempts: attempts }
}

/**
 * Reset failed login attempts after successful password validation.
 *
 * @param {string} username
 */
async function resetFailedLogins(username) {
    let db = await getDatabase()
    let users = db.collection('users')

    await users.updateOne(
        { user: username },
        {
            $set: {
                failedLoginAttempts: 0
            }
        }
    )
}

/**
 * Create a pending 2FA login.
 *
 * @param {string} pendingId
 * @param {string} username
 * @param {string} code
 * @param {number} timeoutSeconds
 */
async function createPendingTwoFactorLogin(pendingId, username, code, timeoutSeconds) {
    let db = await getDatabase()
    let pendingCollection = db.collection('pending_2fa')

    let expiry = new Date(Date.now() + timeoutSeconds * 1000)

    await pendingCollection.insertOne({
        id: pendingId,
        username: username,
        code: code,
        expiry: expiry
    })
}

/**
 * Get a pending 2FA login if it exists and has not expired.
 *
 * @param {string} pendingId
 * @returns {Promise<Object|null>}
 */
async function getPendingTwoFactorLogin(pendingId) {
    let db = await getDatabase()
    let pendingCollection = db.collection('pending_2fa')

    let result = await pendingCollection.findOne({
        id: pendingId
    })

    if (!result) {
        return null
    }

    if (result.expiry <= new Date()) {
        await pendingCollection.deleteOne({ id: pendingId })
        return null
    }

    return result
}

/**
 * Delete a pending 2FA login.
 *
 * @param {string} pendingId
 */
async function deletePendingTwoFactorLogin(pendingId) {
    let db = await getDatabase()
    let pendingCollection = db.collection('pending_2fa')
    await pendingCollection.deleteOne({ id: pendingId })
}

/**
 * Create a new session.
 *
 * @param {string} sessionId
 * @param {number} timeout
 * @param {*} data
 */
async function createSession(sessionId, timeout, data) {
    let db = await getDatabase()
    let sessions = db.collection('sessions')

    let expiresAt = new Date(Date.now() + timeout * 1000)

    await sessions.insertOne({
        id: sessionId,
        expiry: expiresAt,
        data: data
    })
}

/**
 * Get the data associated with a session.
 *
 * @param {string} sessionId
 * @returns {Promise<Object|null>}
 */
async function getSessionData(sessionId) {
    let db = await getDatabase()
    let sessions = db.collection('sessions')

    let result = await sessions.findOne({
        id: sessionId
    })

    if (!result) {
        return null
    }

    if (result.expiry <= new Date()) {
        await sessions.deleteOne({ id: sessionId })
        return null
    }

    return result.data
}

/**
 * Extend a session.
 *
 * @param {string} sessionId
 * @param {number} seconds
 * @returns {Promise<boolean>}
 */
async function extendSession(sessionId, seconds) {
    let db = await getDatabase()
    let sessions = db.collection('sessions')
    let newExpiry = new Date(Date.now() + seconds * 1000)

    let result = await sessions.updateOne(
        { id: sessionId },
        { $set: { expiry: newExpiry } }
    )

    return result.modifiedCount === 1
}

/**
 * Delete a session.
 *
 * @param {string} sessionId
 */
async function deleteSession(sessionId) {
    let db = await getDatabase()
    let sessions = db.collection('sessions')
    await sessions.deleteOne({ id: sessionId })
}

/**
 * Record an event to the security log.
 *
 * @param {string} username
 * @param {string} url
 * @param {string} method
 */
async function logEvent(username, url, method) {
    let db = await getDatabase()
    let securityLog = db.collection('security_log')
    let timestamp = new Date(Date.now())

    await securityLog.insertOne({
        timestamp,
        username,
        url,
        method
    })
}

/**
 * Add document metadata for an employee.
 *
 * @param {string} employeeId
 * @param {Object} documentRecord
 */
async function addEmployeeDocument(employeeId, documentRecord) {
    let db = await getDatabase()
    let employees = db.collection('employees')
    let empMongoId = new mongodb.ObjectId(employeeId)

    await employees.updateOne(
        { _id: empMongoId },
        {
            $push: {
                documents: documentRecord
            }
        }
    )
}

/**
 * Count documents for an employee.
 *
 * @param {string} employeeId
 * @returns {Promise<number>}
 */
async function countEmployeeDocuments(employeeId) {
    let employee = await findEmployee(employeeId)
    if (!employee) {
        return 0
    }

    if (!employee.documents) {
        return 0
    }

    return employee.documents.length
}

/**
 * Get all documents for an employee.
 *
 * @param {string} employeeId
 * @returns {Promise<Array>}
 */
async function getEmployeeDocuments(employeeId) {
    let employee = await findEmployee(employeeId)
    if (!employee) {
        return []
    }

    if (!employee.documents) {
        return []
    }

    return employee.documents
}

/**
 * Get a single document metadata record by its generated id.
 *
 * @param {string} employeeId
 * @param {string} documentId
 * @returns {Promise<Object|null>}
 */
async function getEmployeeDocument(employeeId, documentId) {
    let employee = await findEmployee(employeeId)
    if (!employee) {
        return null
    }

    if (!employee.documents) {
        return null
    }

    let i = 0
    while (i < employee.documents.length) {
        if (employee.documents[i].documentId === documentId) {
            return employee.documents[i]
        }
        i++
    }

    return null
}


module.exports = {
    getAllEmployees,
    findEmployee,
    findShift,
    getEmployeeShifts,
    addEmployeeRecord,
    disconnectDatabase,
    updateEmployee,
    getUserByUsername,
    checkCredentials,
    recordFailedLogin,
    resetFailedLogins,
    createPendingTwoFactorLogin,
    getPendingTwoFactorLogin,
    deletePendingTwoFactorLogin,
    createSession,
    getSessionData,
    extendSession,
    deleteSession,
    logEvent,
    addEmployeeDocument,
    countEmployeeDocuments,
    getEmployeeDocuments,
    getEmployeeDocument
}