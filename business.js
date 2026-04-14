const persistence = require('./persistence.js')
const emailSystem = require('./emailSystem.js')
const crypto = require('crypto')

/**
 * Return a list of all employees loaded from the storage.
 * @returns {Array<{ employeeId: string, name: string, phone: string }>} List of employees
 */
async function getAllEmployees() {
    return await persistence.getAllEmployees()
}

async function getEmployee(id) {
    return await persistence.findEmployee(id)
}

/**
 * Begin the login process.
 * If username/password is valid, create a pending 2FA login but DO NOT create
 * a real session yet.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{status:string, pendingId?:string}>}
 */
async function beginLogin(username, password) {
    let user = await persistence.getUserByUsername(username)

    if (!user) {
        return { status: "INVALID" }
    }

    if (user.accountLocked === true) {
        return { status: "LOCKED" }
    }

    let credentialsValid = await persistence.checkCredentials(username, password)

    if (!credentialsValid) {
        let attemptResult = await persistence.recordFailedLogin(username)

        if (attemptResult.status === "LOCKED") {
            await emailSystem.sendAccountLockedEmail(user.email)
            return { status: "LOCKED" }
        }

        if (attemptResult.status === "WARNING") {
            await emailSystem.sendSuspiciousActivityEmail(user.email)
        }

        return { status: "INVALID" }
    }

    await persistence.resetFailedLogins(username)

    let code = generateSixDigitCode()
    let pendingId = crypto.randomUUID()

    await persistence.createPendingTwoFactorLogin(
        pendingId,
        username,
        code,
        3 * 60
    )

    await emailSystem.sendTwoFactorCode(user.email, code)

    return {
        status: "2FA_REQUIRED",
        pendingId
    }
}

/**
 * Check if a pending 2FA login still exists and has not expired.
 *
 * @param {string} pendingId
 * @returns {Promise<boolean>}
 */
async function pendingLoginValid(pendingId) {
    let pending = await persistence.getPendingTwoFactorLogin(pendingId)
    return pending != null
}

/**
 * Complete login after the user enters the 2FA code.
 *
 * @param {string} pendingId
 * @param {string} code
 * @returns {Promise<{status:string, sessionId?:string, duration?:number}>}
 */
async function completeTwoFactorLogin(pendingId, code) {
    let pending = await persistence.getPendingTwoFactorLogin(pendingId)

    if (!pending) {
        return { status: "EXPIRED" }
    }

    if (pending.code !== code) {
        return { status: "INVALID" }
    }

    let sessionId = crypto.randomUUID()
    let duration = 5 * 60

    await persistence.createSession(sessionId, duration, {
        user: pending.username
    })

    await persistence.deletePendingTwoFactorLogin(pendingId)

    return {
        status: "SUCCESS",
        sessionId,
        duration
    }
}

/**
 * Determine if there is an active session.
 *
 * @param {string} sessionId
 * @returns {Promise<boolean>}
 */
async function validSession(sessionId) {
    let result = await persistence.getSessionData(sessionId)
    return result != null
}

/**
 * Extend a session.
 *
 * @param {string} sessionId
 * @returns {Promise<number>}
 */
async function extendSession(sessionId) {
    let extension = 5 * 60
    await persistence.extendSession(sessionId, extension)
    return extension
}

/**
 * End a session by deleting it.
 *
 * @param {string} sessionId
 */
async function endSession(sessionId) {
    await persistence.deleteSession(sessionId)
}

/**
 * Log an event to the security log.
 *
 * @param {string} sessionId
 * @param {string} url
 * @param {string} method
 */
async function logEvent(sessionId, url, method) {
    let sessionData = await persistence.getSessionData(sessionId)
    let username = ""
    if (sessionData) {
        username = sessionData.user
    }
    await persistence.logEvent(username, url, method)
}

/**
 * Get a list of shifts for an employee.
 *
 * @param {string} empId
 * @returns {Array<{string}>}
 */
async function getEmployeeShifts(empId) {
    return await persistence.getEmployeeShifts(empId)
}

/**
 * Add a new employee record to the system.
 *
 * @param {{name:string, phone:string}} emp
 */
async function addEmployeeRecord(emp) {
    return await persistence.addEmployeeRecord(emp)
}

/**
 * Assign a shift to an employee.
 *
 * @param {string} empId
 * @param {string} shiftId
 * @returns {string}
 */
async function assignShift(empId, shiftId) {
    let employee = await persistence.findEmployee(empId)
    if (!employee) {
        return "Employee does not exist"
    }

    let shift = await persistence.findShift(shiftId)
    if (!shift) {
        return "Shift does not exist"
    }

    let assignment = await persistence.findAssignment(empId, shiftId)
    if (assignment) {
        return "Employee already assigned to shift"
    }

    let maxHours = await persistence.getDailyMaxHours()
    let currentShifts = await persistence.getEmployeeShiftsOnDate(empId, shift.date)
    let newShiftLength = computeShiftDuration(shift.startTime, shift.endTime)
    let scheduledHours = 0

    for (let s of currentShifts) {
        scheduledHours += computeShiftDuration(s.startTime, s.endTime)
    }

    let newAllocation = newShiftLength + scheduledHours

    if (newAllocation > maxHours) {
        return "Hour Violation"
    }

    await persistence.addAssignment(empId, shiftId)

    return "Ok"
}

/**
 * Computes the duration of a shift in hours.
 *
 * @param {string} startTime
 * @param {string} endTime
 * @returns {number}
 */
function computeShiftDuration(startTime, endTime) {
    let startParts = startTime.split(":")
    let endParts = endTime.split(":")

    let startHour = Number(startParts[0])
    let startMinute = Number(startParts[1])
    let endHour = Number(endParts[0])
    let endMinute = Number(endParts[1])

    let startTotalMinutes = startHour * 60 + startMinute
    let endTotalMinutes = endHour * 60 + endMinute

    return (endTotalMinutes - startTotalMinutes) / 60
}

/**
 * Generate a 6-digit numeric code as a string.
 *
 * @returns {string}
 */
function generateSixDigitCode() {
    let code = ""
    let i = 0

    while (i < 6) {
        code += Math.floor(Math.random() * 10)
        i++
    }

    return code
}

async function disconnectDatabase() {
    await persistence.disconnectDatabase()
}

async function updateEmployee(emp) {
    return await persistence.updateEmployee(emp)
}
async function addEmployeeDocument(employeeId, documentRecord) {
    await persistence.addEmployeeDocument(employeeId, documentRecord)
}

async function countEmployeeDocuments(employeeId) {
    return await persistence.countEmployeeDocuments(employeeId)
}

async function getEmployeeDocuments(employeeId) {
    return await persistence.getEmployeeDocuments(employeeId)
}

async function getEmployeeDocument(employeeId, documentId) {
    return await persistence.getEmployeeDocument(employeeId, documentId)
}

module.exports = {
    getAllEmployees,
    assignShift,
    addEmployeeRecord,
    getEmployeeShifts,
    disconnectDatabase,
    getEmployee,
    updateEmployee,
    beginLogin,
    pendingLoginValid,
    completeTwoFactorLogin,
    validSession,
    extendSession,
    endSession,
    logEvent, 
    addEmployeeDocument,
    countEmployeeDocuments,
    getEmployeeDocuments,
    getEmployeeDocument
}