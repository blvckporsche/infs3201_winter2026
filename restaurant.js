const fs = require('fs/promises')
const prompt=require('prompt-sync')()

/**
 * Return a list of all employees loaded from the storage.
 * @returns {Array<{ employeeId: string, name: string, phone: string }>} List of employees
 */
async function getAllEmployees() {
    let rawData = await fs.readFile('employees.json')
    result = JSON.parse(rawData)
    return result
}

/**
 * Find a single employee given their ID number.
 * @param {string} empId 
 * @returns {{ employeeId: string, name: string, phone: string }|undefined}
 */
async function findEmployee(empId) {
    let rawData = await fs.readFile('employees.json')
    employeeList = JSON.parse(rawData)
    for (let emp of employeeList) {
        if (emp.employeeId === empId) {
            return emp
        }
    }
    return undefined
}

/**
 * Get a single shift given the shiftId
 * @param {string} shiftId 
 * @returns {{shiftId:string, date:string, startTime:string, endTime:string}|undefined}
 */
async function findShift(shiftId) {
    let rawData = await fs.readFile('shifts.json')
    shiftList = JSON.parse(rawData)
    for (let shift of shiftList) {
        if (shift.shiftId == shiftId) {
            return shift
        }
    }
    return undefined
}

/**
 * Get a list of shiftIDs for an employee.
 * @param {string} empId 
 * @returns {Array<{string}>}
 */
async function getEmployeeShifts(empId) {
    let rawData = await fs.readFile('assignments.json')
    assignmentList = JSON.parse(rawData)
    let shiftIds = []
    for (let asn of assignmentList) {
        if (asn.employeeId == empId) {
            shiftIds.push(asn.shiftId)
        }
    }

    rawData = await fs.readFile('shifts.json')
    shiftList = JSON.parse(rawData)
    let shiftDetails = []
    for (let sh of shiftList) {
        if (shiftIds.includes(sh.shiftId)) {
            shiftDetails.push(sh)
        }
    }

    return shiftDetails
}

/**
 * Find a shift object give the employeeId and the shiftId.
 * @param {string} empId 
 * @param {string} shiftId 
 * @returns {{employeeId:string, shiftId:string}|undefined}
 */
async function findAssignment(empId, shiftId) {
    let rawData = await fs.readFile('assignments.json')
    assignmentList = JSON.parse(rawData)
    for (let asn of assignmentList) {
        if (asn.employeeId === empId && asn.shiftId === shiftId) {
            return asn
        }
    }
    return undefined
}

/**
 * Record a new assignment of an employee to a shift. This functions does not
 * check for existing combinations so it is possible to double book an employee,
 * use assignShift instead to check for this.
 * @param {string} empId 
 * @param {string} shiftId 
 */
async function addAssignment(empId, shiftId) {
    let rawData = await fs.readFile('assignments.json')
    assignmentList = JSON.parse(rawData)
    assignmentList.push({employeeId: empId, shiftId: shiftId})
    await fs.writeFile('assignments.json', JSON.stringify(assignmentList, null, 4))
}

/**
 * Add a new employee record to the system. The empId is automatically generated based
 * on the next available ID number from what is already in the file.
 * @param {{name:string, phone:string}} emp 
 */
async function addEmployeeRecord(emp) {
    let maxId = 0
    let rawData = await fs.readFile('employees.json')
    let employeeList = JSON.parse(rawData)
    for (let e of employeeList) {
        let eid = Number(e.employeeId.slice(1))
        if (eid > maxId) {
            maxId = eid
        }
    }
    emp.employeeId = `E${String(maxId+1).padStart(3,'0')}`
    employeeList.push(emp)
    await fs.writeFile('employees.json', JSON.stringify(employeeList, null, 4))
}

/**
 * This function attempts to assign a shift to an employee. This function checks to ensure
 * that the employee exists, the shift exists, and that the combination employee/shift has 
 * not already been recorded.
 * 
 * The function currently returns string messages indicating whether the operation was successful
 * or why it failed.  A serious improvement would be to use exceptions; this will be refactored
 * at a later time.
 * 
 * @param {string} empId 
 * @param {string} shiftId 
 * @returns {string} A message indicating the problem of the word "Ok"
 */
async function assignShift(empId, shiftId) {
    // check that empId exists
    let employee = await findEmployee(empId)
    if (!employee) {
        return "Employee does not exist"
    }
    // check that shiftId exists
    let shift = await findShift(shiftId)
    if (!shift) {
        return "Shift does not exist"
    }
    // check that empId,shiftId doesn't exist
    let assignment = await findAssignment(empId, shiftId)
    if (assignment) {
        return "Employee already assigned to shift"
    }
    // add empId,shiftId into the bridge
    await addAssignment(empId, shiftId)
    return "Ok"
}

/**
 * A function to interact with the user and display the results of the
 * employee schedule in a CSV like format.
 */
async function getEmployeeSchedule() {
    let empId = prompt('Enter employee ID: ')
    let details = await getEmployeeShifts(empId)
    console.log('\n')
    console.log('date,start,end')
    for (let d of details) {
        console.log(`${d.date},${d.startTime},${d.endTime}`)
    }
}

/**
 * Display the employee list in a nicely formatted table.
 */
async function displayEmployees() {
    let employees = await getAllEmployees()
    console.log('Employee ID  Name                Phone')
    console.log('-----------  ------------------- ---------')
    for (let emp of employees) {
        console.log(`${emp.employeeId.padEnd(13)}${emp.name.padEnd(20)}${emp.phone}`)
    }
}

/**
 * The UI function for adding a new employee to the system.
 */
async function addNewEmployee() {
    let name = prompt('Enter employee name: ')
    let phone = prompt('Enter phone number: ')
    await addEmployeeRecord({
        name: name,
        phone: phone
    })
    console.log('Employee added...')
}

/**
 * The UI function for assigning an employee to a shift.
 */
async function scheduleEmployee() {
    let empId = prompt('Enter employee ID: ')
    let shiftId = prompt(' Enter shift ID: ')
    let result = await assignShift(empId, shiftId)
    if (result === 'Ok') {
        console.log("Shift Recorded")
    }
    else {
        console.log(result)
    }
}

/**
 * The UI function for displaying the menu and calling the various UI functions.  The function
 * is made async because many of the called functions are also async.
 */
async function displayMenu() {
    while (true) {
        console.log('1. Show all employees')
        console.log('2. Add new employee')
        console.log('3. Assign employee to shift')
        console.log('4. View employee schedule')
        console.log('5. Exit')
        let choice = Number(prompt("What is your choice> "))
        if (choice === 1) {
            await displayEmployees()
            console.log('\n\n')
        }
        else if (choice == 2) {
            await addNewEmployee()
            console.log('\n\n')
        }
        else if (choice == 3) {
            await scheduleEmployee()
            console.log('\n\n')
        }
        else if (choice == 4) {
            await getEmployeeSchedule()
            console.log('\n\n')
        }
        else if (choice == 5) {
            break
        }
        else {
            console.log("Error in selection")
        }
    }
    console.log('*** Goodbye!')
}

displayMenu()

