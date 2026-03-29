const persistence = require("./persistence");
const crypto = require("crypto");

/**
 * Initialize system
 */
async function initialize() {
    await persistence.connect();
}

/**
 * List employees
 */
async function listEmployees() {
    return await persistence.getAllEmployees();
}

/**
 * Get employee details
 */
async function getEmployeeDetails(employeeId) {

    const employee = await persistence.getEmployeeById(employeeId);
    if (!employee) return null;

    const shiftsData = await persistence.getAllShifts();
    const shifts = [];

    for (let i = 0; i < shiftsData.length; i++) {

        let shift = shiftsData[i];
        let found = false;

        for (let j = 0; j < shift.employees.length; j++) {
            if (shift.employees[j].toString() === employee._id.toString()) {
                found = true;
            }
        }

        if (found) {
            if (shift.startTime < "12:00") {
                shift.isMorning = true;
            } else {
                shift.isMorning = false;
            }

            shifts.push(shift);
        }
    }

    for (let i = 0; i < shifts.length; i++) {
        for (let j = i + 1; j < shifts.length; j++) {

            if (shifts[j].date < shifts[i].date ||
               (shifts[j].date === shifts[i].date &&
                shifts[j].startTime < shifts[i].startTime)) {

                let temp = shifts[i];
                shifts[i] = shifts[j];
                shifts[j] = temp;
            }
        }
    }

    employee.shifts = shifts;
    return employee;
}

/**
 * Edit employee
 */
async function editEmployee(employeeId, name, phone) {

    name = name.trim();
    phone = phone.trim();

    if (name.length === 0) return "Name must not be empty.";

    const regex = /^[0-9]{4}-[0-9]{4}$/;
    if (!regex.test(phone)) return "Phone must be in format 1234-5678.";

    await persistence.updateEmployee(employeeId, name, phone);
    return null;
}

/**
 * Create user
 */
async function createUser(email, password, type) {

    if (!email || !password) return "Invalid input";

    const hash = crypto.createHash("sha256").update(password).digest("hex");

    await persistence.insertUser(email, hash, type);
    return null;
}

/**
 * Login user
 */
async function login(email, password) {

    const user = await persistence.getUserByEmail(email);
    if (!user) return null;

    const hash = crypto.createHash("sha256").update(password).digest("hex");

    if (hash !== user.password) return null;

    return await persistence.createSession(user.email, user.type);
}

/**
 * Get session
 */
async function getSession(sessionId) {
    return await persistence.getSession(sessionId);
}

/**
 * Delete session
 */
async function deleteSession(sessionId) {
    await persistence.deleteSession(sessionId);
}

/**
 * Extend session
 */
async function extendSession(sessionId) {
    await persistence.extendSession(sessionId);
}

/**
 * Log security
 */
async function logSecurity(email, url, method) {
    await persistence.insertLog(email, url, method);
}

module.exports = {
    initialize,
    listEmployees,
    getEmployeeDetails,
    editEmployee,
    createUser,
    login,
    getSession,
    deleteSession,
    extendSession,
    logSecurity
};