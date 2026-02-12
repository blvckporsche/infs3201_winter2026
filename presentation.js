// presentation.js
const prompt = require('prompt-sync')()

const {
  listEmployees,
  createEmployee,
  getSchedule,
  assignShiftWithRules
} = require('./business')

/**
 * Display all employees in a formatted table.
 * @returns {Promise<void>}
 */
async function displayEmployees() {
  const employees = await listEmployees()
  console.log('Employee ID  Name                 Phone')
  console.log('----------- -------------------- ---------')
  for (let emp of employees) {
    console.log(`${emp.employeeId.padEnd(11)}${emp.name.padEnd(20)}${emp.phone}`)
  }
}

/**
 * Add a new employee by asking user for input.
 * @returns {Promise<void>}
 */
async function addNewEmployee() {
  const name = prompt('Enter employee name: ')
  const phone = prompt('Enter phone number: ')
  await createEmployee({ name, phone })
  console.log('Employee added...')
}

/**
 * Assign an employee to a shift, showing the result message.
 * @returns {Promise<void>}
 */
async function scheduleEmployee() {
  const empId = prompt('Enter employee ID: ')
  const shiftId = prompt('Enter shift ID: ')
  const result = await assignShiftWithRules(empId, shiftId)
  if (result === 'Ok') {
    console.log('Shift Recorded')
  } else {
    console.log(result)
  }
}

/**
 * Display an employee schedule in CSV-like format.
 * @returns {Promise<void>}
 */
async function getEmployeeScheduleUI() {
  const empId = prompt('Enter employee ID: ')
  const details = await getSchedule(empId)

  console.log('\n')
  console.log('date,start,end')
  for (let d of details) {
    console.log(`${d.date},${d.startTime},${d.endTime}`)
  }
}

/**
 * Main menu loop.
 * @returns {Promise<void>}
 */
async function displayMenu() {
  while (true) {
    console.log('1. Show all employees')
    console.log('2. Add new employee')
    console.log('3. Assign employee to shift')
    console.log('4. View employee schedule')
    console.log('5. Exit')
    const choice = Number(prompt('What is your choice> '))

    if (choice === 1) {
      await displayEmployees()
      console.log('\n\n')
    } else if (choice === 2) {
      await addNewEmployee()
      console.log('\n\n')
    } else if (choice === 3) {
      await scheduleEmployee()
      console.log('\n\n')
    } else if (choice === 4) {
      await getEmployeeScheduleUI()
      console.log('\n\n')
    } else if (choice === 5) {
      break
    } else {
      console.log('Error in selection')
    }
  }

  console.log('*** Goodbye!')
}

displayMenu()
