const { MongoClient, ObjectId } = require("mongodb");

const uri = "mongodb+srv://60301940:MoezMoazzam@moez.zopntoi.mongodb.net/";
const client = new MongoClient(uri);

async function connectDB() {
    await client.connect();
    return client.db("assignment4");
}

async function step1_addEmployeesArray() {
    const db = await connectDB();
    const shifts = db.collection("shifts");

    const allShifts = await shifts.find({}).toArray();

    for (let i = 0; i < allShifts.length; i++) {
        await shifts.updateOne(
            { _id: allShifts[i]._id },
            { $set: { employees: [] } }
        );
    }

    console.log("Step 1 complete");
}

async function step2_embedEmployees() {
    const db = await connectDB();

    const assignments = db.collection("assignments");
    const shifts = db.collection("shifts");
    const employees = db.collection("employees");

    const allAssignments = await assignments.find({}).toArray();

    for (let i = 0; i < allAssignments.length; i++) {
        let assignment = allAssignments[i];

        let employee = await employees.findOne({ employeeId: assignment.employeeId });
        if (!employee) continue;

        let shift = await shifts.findOne({ shiftId: assignment.shiftId });
        if (!shift) continue;

        await shifts.updateOne(
            { _id: shift._id },
            { $push: { employees: employee._id } }
        );
    }

    console.log("Step 2 complete");
}

async function step3_cleanup() {
    const db = await connectDB();

    const employees = db.collection("employees");
    const shifts = db.collection("shifts");

    await employees.updateMany({}, { $unset: { employeeId: "" } });
    await shifts.updateMany({}, { $unset: { shiftId: "" } });
    await db.collection("assignments").drop();

    console.log("Step 3 complete");
}

async function runAll() {
    await step1_addEmployeesArray();
    await step2_embedEmployees();
    await step3_cleanup();

    console.log("Done");
    process.exit();
}

// runAll();