// persistence.js
const fs = require('fs/promises')

/**
 * Load all employees from storage.
 * @returns {Promise<Array<{ employeeId: string, name: string, phone: string }>>}
 */
async function getAllEmployees() {
  const rawData = await fs.readFile('employees.json')
  const result = JSON.parse(rawData)
  return result
}

/**
 * Find a single employee given their ID number.
 * @param {string} empId
 * @returns {Promise<{ employeeId: string, name: string, phone: string }|undefined>}
 */
async function findEmployee(empId) {
  const rawData = await fs.readFile('employees.json')
  const employeeList = JSON.parse(rawData)
  for (let emp of employeeList) {
    if (emp.employeeId === empId) {
      return emp
    }
  }
  return undefined
}

/**
 * Get a single shift given the shiftId.
 * @param {string} shiftId
 * @returns {Promise<{shiftId:string, date:string, startTime:string, endTime:string}|undefined>}
 */
async function findShift(shiftId) {
  const rawData = await fs.readFile('shifts.json')
  const shiftList = JSON.parse(rawData)
  for (let shift of shiftList) {
    if (shift.shiftId === shiftId) {
      return shift
    }
  }
  return undefined
}

/**
 * Get all shifts.
 * @returns {Promise<Array<{shiftId:string, date:string, startTime:string, endTime:string}>>}
 */
async function getAllShifts() {
  const rawData = await fs.readFile('shifts.json')
  const shiftList = JSON.parse(rawData)
  return shiftList
}

/**
 * Get all assignments (employee-shift relationships).
 * @returns {Promise<Array<{employeeId:string, shiftId:string}>>}
 */
async function getAllAssignments() {
  const rawData = await fs.readFile('assignments.json')
  const assignmentList = JSON.parse(rawData)
  return assignmentList
}

/**
 * Find a shift assignment given employeeId and shiftId.
 * @param {string} empId
 * @param {string} shiftId
 * @returns {Promise<{employeeId:string, shiftId:string}|undefined>}
 */
async function findAssignment(empId, shiftId) {
  const rawData = await fs.readFile('assignments.json')
  const assignmentList = JSON.parse(rawData)
  for (let asn of assignmentList) {
    if (asn.employeeId === empId && asn.shiftId === shiftId) {
      return asn
    }
  }
  return undefined
}

/**
 * Add an assignment (no duplicate check here).
 * @param {string} empId
 * @param {string} shiftId
 * @returns {Promise<void>}
 */
async function addAssignment(empId, shiftId) {
  const rawData = await fs.readFile('assignments.json')
  const assignmentList = JSON.parse(rawData)
  assignmentList.push({ employeeId: empId, shiftId: shiftId })
  await fs.writeFile('assignments.json', JSON.stringify(assignmentList, null, 4))
}

/**
 * Add a new employee record.
 * @param {{name:string, phone:string}} emp
 * @returns {Promise<void>}
 */
async function addEmployeeRecord(emp) {
  let maxId = 0
  const rawData = await fs.readFile('employees.json')
  const employeeList = JSON.parse(rawData)

  for (let e of employeeList) {
    const eid = Number(e.employeeId.slice(1))
    if (eid > maxId) {
      maxId = eid
    }
  }

  emp.employeeId = `E${String(maxId + 1).padStart(3, '0')}`
  employeeList.push(emp)
  await fs.writeFile('employees.json', JSON.stringify(employeeList, null, 4))
}

/**
 * Get all shifts for a given employeeId (using assignments.json + shifts.json).
 * @param {string} empId
 * @returns {Promise<Array<{shiftId:string, date:string, startTime:string, endTime:string}>>}
 */
async function getEmployeeShifts(empId) {
  const rawAssignments = await fs.readFile('assignments.json')
  const assignmentList = JSON.parse(rawAssignments)

  const shiftIds = []
  for (let asn of assignmentList) {
    if (asn.employeeId === empId) {
      shiftIds.push(asn.shiftId)
    }
  }

  const rawShifts = await fs.readFile('shifts.json')
  const shiftList = JSON.parse(rawShifts)

  const shiftDetails = []
  for (let sh of shiftList) {
    if (shiftIds.includes(sh.shiftId)) {
      shiftDetails.push(sh)
    }
  }
  return shiftDetails
}

/**
 * Load config (maxDailyHours).
 * @returns {Promise<{maxDailyHours:number}>}
 */
async function getConfig() {
  const raw = await fs.readFile('config.json')
  const cfg = JSON.parse(raw)
  return cfg
}

module.exports = {
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
}
