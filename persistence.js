const express = require("express");
const exphbs = require("express-handlebars");
const business = require("./business");

const app = express();

app.engine("handlebars", exphbs.engine({
    defaultLayout: false
}));

app.set("view engine", "handlebars");
app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: false }));

/**
 * Landing Page
 */
app.get("/", async (req, res) => {
    const employees = await business.listEmployees();
    res.render("landing", { employees: employees });
});

/**
 * Employee Details
 */
app.get("/employee/:employeeId", async (req, res) => {

    const employee =
        await business.getEmployeeDetails(req.params.employeeId);

    if (!employee) {
        res.send("Employee not found.");
        return;
    }

    res.render("employeeDetails", { employee: employee });
});

/**
 * Edit Form
 */
app.get("/employee/:employeeId/edit", async (req, res) => {

    const employee =
        await business.getEmployeeDetails(req.params.employeeId);

    if (!employee) {
        res.send("Employee not found.");
        return;
    }

    res.render("editEmployee", { employee: employee });
});

/**
 * Edit Submission (PRG)
 */
app.post("/employee/:employeeId/edit", async (req, res) => {

    const error = await business.editEmployee(
        req.params.employeeId,
        req.body.name,
        req.body.phone
    );

    if (error !== null) {
        res.send(error);
        return;
    }

    res.redirect("/");
});

/**
 * Start server
 */
async function start() {
    await business.initialize();
    app.listen(8000);
}

start();