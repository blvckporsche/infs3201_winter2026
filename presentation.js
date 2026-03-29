const express = require("express");
const exphbs = require("express-handlebars");
const business = require("./business");

const app = express();

app.engine("handlebars", exphbs.engine({ defaultLayout: false }));
app.set("view engine", "handlebars");
app.set("views", __dirname + "/views");

app.use(express.urlencoded({ extended: false }));

/**
 * Parse cookies from request
 * @param {Object} req
 * @returns {Object}
 */
function parseCookies(req) {
    const list = {};
    const rc = req.headers.cookie;

    if (rc) {
        const cookies = rc.split(";");
        for (let i = 0; i < cookies.length; i++) {
            const parts = cookies[i].split("=");
            list[parts[0].trim()] = parts[1];
        }
    }
    return list;
}

/**
 * Session middleware
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 */
async function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req);

    if (!cookies.sessionId) {
        req.user = null;
        return next();
    }

    const session = await business.getSession(cookies.sessionId);

    if (!session) {
        req.user = null;
        return next();
    }

    if (Date.now() > session.expiry) {
        await business.deleteSession(cookies.sessionId);
        req.user = null;
        return next();
    }

    await business.extendSession(cookies.sessionId);

    req.user = {
        email: session.email,
        type: session.type
    };

    next();
}

/**
 * Authentication middleware
 */
function authRequired(req, res, next) {
    if (!req.user) {
        res.redirect("/login");
        return;
    }
    next();
}

/**
 * Security logging middleware
 */
async function securityLog(req, res, next) {
    await business.logSecurity(
        req.user ? req.user.email : null,
        req.originalUrl,
        req.method
    );
    next();
}

app.use(sessionMiddleware);
app.use(securityLog);

/**
 * Signup page
 */
app.get("/signup", (req, res) => {
    res.render("signup");
});

/**
 * Signup submission
 */
app.post("/signup", async (req, res) => {
    const error = await business.createUser(
        req.body.email,
        req.body.password,
        req.body.type
    );

    if (error) {
        res.send(error);
        return;
    }

    res.redirect("/login");
});

/**
 * Login page
 */
app.get("/login", (req, res) => {
    res.render("login");
});

/**
 * Login submission
 */
app.post("/login", async (req, res) => {

    const sessionId = await business.login(
        req.body.email,
        req.body.password
    );

    if (!sessionId) {
        res.redirect("/login");
        return;
    }

    res.setHeader("Set-Cookie", "sessionId=" + sessionId);
    res.redirect("/");
});

/**
 * Logout
 */
app.get("/logout", async (req, res) => {
    const cookies = parseCookies(req);

    if (cookies.sessionId) {
        await business.deleteSession(cookies.sessionId);
    }

    res.setHeader("Set-Cookie", "sessionId=;");
    res.redirect("/login");
});

/**
 * Landing page
 */
app.get("/", authRequired, async (req, res) => {
    const employees = await business.listEmployees();
    res.render("landing", { employees: employees, user: req.user });
});

/**
 * Employee details
 */
app.get("/employee/:employeeId", authRequired, async (req, res) => {

    const employee = await business.getEmployeeDetails(req.params.employeeId);

    if (!employee) {
        res.send("Employee not found.");
        return;
    }

    res.render("employeeDetails", {
        employee: employee,
        user: req.user
    });
});

/**
 * Edit form (admin only)
 */
app.get("/employee/:employeeId/edit", authRequired, async (req, res) => {

    if (req.user.type !== "admin") {
        res.send("Access denied");
        return;
    }

    const employee = await business.getEmployeeDetails(req.params.employeeId);

    if (!employee) {
        res.send("Employee not found.");
        return;
    }

    res.render("editEmployee", { employee: employee });
});

/**
 * Edit submission (admin only)
 */
app.post("/employee/:employeeId/edit", authRequired, async (req, res)=> {

    if (req.user.type !== "admin") {
        res.send("Access denied");
        return;
    }

    const error = await business.editEmployee(
        req.params.employeeId,
        req.body.name,
        req.body.phone
    );

    if (error) {
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