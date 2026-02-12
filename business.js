// business.js
const {
  getAllEmployees,
  findEmployee,
  findShift,
  getAllShifts,
  getAllAssignments,
  findAssignment,
  addAssignment,
  addEmployeeRecord,
  getEmployeeShifts,
  getConfig
} = require('./persistence')

/**
 * Return all employees (pass-through from persistence).
 * @returns {Promise<Array<{ employeeId: string, name: string, phone: string }>>}
 */
async function listEmployees() {
  return await getAllEmployees()
}

/**
 * Create a new employee.
 * @param {{name:string, phone:string}} emp
 * @returns {Promise<void>}
 */
async function createEmployee(emp) {
  await addEmployeeRecord(emp)
}

/**
 * Get an employee schedule (array of shifts).
 * @param {string} empId
 * @returns {Promise<Array<{shiftId:string, date:string, startTime:string, endTime:string}>>}
 */
async function getSchedule(empId) {
  return await getEmployeeShifts(empId)
}

/**
 * Compute the duration of a shift in hours (floating point).
 * Times are in "HHMM" (e.g., "0900", "1330").
 *
 * LLM: Perplexity, powered by GPT-5.1
 * Prompt used: "Write a NodeJS function computeShiftDuration(startTime, endTime) that receives two strings like '0900' and '1330' and returns the number of hours between them as a real number."
 *
 * @param {string} startTime
 * @param {string} endTime
 * @returns {number}
 */
function computeShiftDuration(startTime, endTime) {
  const startHours = Number(startTime.substring(0, 2))
  const startMinutes = Number(startTime.substring(2, 4))
  const endHours = Number(endTime.substring(0, 2))
  const endMinutes = Number(endTime.substring(2, 4))

  let startTotalMinutes = startHours * 60 + startMinutes
  let endTotalMinutes = endHours * 60 + endMinutes

  // Support overnight shifts: if end is "earlier" than start, assume next day.
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60
  }

  const diffMinutes = endTotalMinutes - startTotalMinutes
  const diffHours = diffMinutes / 60
  return diffHours
}

/**
 * Check if assigning a new shift would exceed maxDailyHours for that employee on that date.
 * @param {string} empId
 * @param {{shiftId:string, date:string, startTime:string, endTime:string}} newShift
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
async function checkDailyHoursLimit(empId, newShift) {
  const config = await getConfig()
  const maxDailyHours = config.maxDailyHours

  const allAssignments = await getAllAssignments()
  const allShifts = await getAllShifts()

  // Find all shiftIds assigned to this employee on that date
  const currentShiftIds = []
  for (let asn of allAssignments) {
    if (asn.employeeId === empId) {
      currentShiftIds.push(asn.shiftId)
    }
  }

  let totalHours = 0

  for (let sh of allShifts) {
    if (currentShiftIds.includes(sh.shiftId) && sh.date === newShift.date) {
      totalHours += computeShiftDuration(sh.startTime, sh.endTime)
    }
  }

  // Add new shift hours
  totalHours += computeShiftDuration(newShift.startTime, newShift.endTime)

  if (totalHours > maxDailyHours) {
    return {
      ok: false,
      reason: `This assignment would exceed the daily limit of ${maxDailyHours} hours for this employee on ${newShift.date}.`
    }
  }

  return { ok: true }
}

/**
 * Assign a shift to an employee with full business checks:
 *  - employee exists
 *  - shift exists
 *  - combination emp/shift not already assigned
 *  - daily hours cap not exceeded
 *
 * @param {string} empId
 * @param {string} shiftId
 * @returns {Promise<string>} "Ok" or an error message
 */
async function assignShiftWithRules(empId, shiftId) {
  const employee = await findEmployee(empId)
  if (!employee) {
    return 'Employee does not exist'
  }

  const shift = await findShift(shiftId)
  if (!shift) {
    return 'Shift does not exist'
  }

  const existing = await findAssignment(empId, shiftId)
  if (existing) {
    return 'Employee already assigned to shift'
  }

  // NEW: daily hours cap check
  const limitCheck = await checkDailyHoursLimit(empId, shift)
  if (!limitCheck.ok) {
    return limitCheck.reason
  }

  // All good, persist the assignment
  await addAssignment(empId, shiftId)
  return 'Ok'
}

module.exports = {
  listEmployees,
  createEmployee,
  getSchedule,
  assignShiftWithRules,
  computeShiftDuration
}
