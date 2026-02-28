const persistence = require("./persistence");

/**
 * Initialize system
 */
async function initialize() {
    await persistence.connect();
}

/**
 * List all employees
 */
async function listEmployees() {
    return await persistence.getAllEmployees();
}

/**
 * Get employee details including assigned shifts
 */
async function getEmployeeDetails(employeeId) {

    const employee = await persistence.getEmployeeById(employeeId);

    if (!employee) {
        return null;
    }

    const assignments =
        await persistence.getAssignmentsForEmployee(employeeId);

    const shifts = [];

    for (let i = 0; i < assignments.length; i++) {

        const shift =
            await persistence.getShiftById(assignments[i].shiftId);

        if (shift) {

            if (shift.startTime < "12:00") {
                shift.isMorning = true;
            } else {
                shift.isMorning = false;
            }

            shifts.push(shift);
        }
    }

    // Manual sort by date then startTime
    for (let i = 0; i < shifts.length; i++) {
        for (let j = i + 1; j < shifts.length; j++) {

            if (shifts[j].date < shifts[i].date ||
               (shifts[j].date === shifts[i].date &&
                shifts[j].startTime < shifts[i].startTime)) {

                const temp = shifts[i];
                shifts[i] = shifts[j];
                shifts[j] = temp;
            }
        }
    }

    employee.shifts = shifts;

    return employee;
}

/**
 * Validate and update employee
 */
async function editEmployee(employeeId, name, phone) {

    name = name.trim();
    phone = phone.trim();

    if (name.length === 0) {
        return "Name must not be empty.";
    }

    const regex = /^[0-9]{4}-[0-9]{4}$/;

    if (!regex.test(phone)) {
        return "Phone must be in format 1234-5678.";
    }

    await persistence.updateEmployee(employeeId, name, phone);

    return null;
}

module.exports = {
    initialize,
    listEmployees,
    getEmployeeDetails,
    editEmployee
};