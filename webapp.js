const express = require('express')
const handlebars = require('express-handlebars')
const cookieParser = require('cookie-parser')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const business = require('./business.js')

const app = express()

app.set('view engine', 'hbs')
app.set('views', __dirname + "/template")
app.engine('hbs', handlebars.engine())

app.use('/public', express.static(__dirname + "/static"))
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

const uploadFolder = path.join(__dirname, 'uploads', 'employee_documents')
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder)
    },
    filename: function (req, file, cb) {
        let uniqueName = Date.now() + "-" + crypto.randomUUID() + ".pdf"
        cb(null, uniqueName)
    }
})

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'application/pdf') {
            cb(new Error('Only PDF files are allowed'))
            return
        }
        cb(null, true)
    }
})

app.use(async (req, res, next) => {
    let sessionId = req.cookies.session
    await business.logEvent(sessionId, req.url, req.method)
    next()
})

app.get('/login', (req, res) => {
    let message = req.query.msg
    if (!message) {
        message = ""
    }

    res.render('login', {
        message,
        layout: undefined
    })
})

app.post('/login', async (req, res) => {
    let username = req.body.username
    let password = req.body.password

    if (!username || !password) {
        res.redirect('/login?msg=Username and password are required')
        return
    }

    username = username.trim()
    password = password.trim()

    if (username === '' || password === '') {
        res.redirect('/login?msg=Username and password are required')
        return
    }

    let loginResult = await business.beginLogin(username, password)

    if (loginResult.status === "INVALID") {
        res.redirect('/login?msg=Invalid username/password')
        return
    }

    if (loginResult.status === "LOCKED") {
        res.redirect('/login?msg=Account locked')
        return
    }

    if (loginResult.status === "2FA_REQUIRED") {
        res.cookie('pending2fa', loginResult.pendingId, { maxAge: 3 * 60 * 1000, httpOnly: true })
        res.redirect('/2fa')
        return
    }

    res.redirect('/login?msg=Unexpected login error')
})

app.get('/2fa', async (req, res) => {
    let pendingId = req.cookies.pending2fa
    if (!pendingId) {
        res.redirect('/login?msg=Please login first')
        return
    }

    let pendingStillValid = await business.pendingLoginValid(pendingId)
    if (!pendingStillValid) {
        res.clearCookie('pending2fa')
        res.redirect('/login?msg=2FA session expired')
        return
    }

    let message = req.query.msg
    if (!message) {
        message = ""
    }

    res.render('two_factor', {
        message,
        layout: undefined
    })
})

app.post('/verify-2fa', async (req, res) => {
    let pendingId = req.cookies.pending2fa
    let code = req.body.code

    if (!pendingId) {
        res.redirect('/login?msg=Please login again')
        return
    }

    if (!code) {
        res.redirect('/2fa?msg=Code is required')
        return
    }

    code = code.trim()

    let result = await business.completeTwoFactorLogin(pendingId, code)

    if (result.status === "INVALID") {
        res.redirect('/2fa?msg=Invalid code')
        return
    }

    if (result.status === "EXPIRED") {
        res.clearCookie('pending2fa')
        res.redirect('/login?msg=2FA code expired')
        return
    }

    if (result.status === "SUCCESS") {
        res.clearCookie('pending2fa')
        res.cookie('session', result.sessionId, {
            maxAge: result.duration * 1000,
            httpOnly: true
        })
        res.redirect('/')
        return
    }

    res.redirect('/login?msg=Could not complete login')
})

app.get('/logout', async (req, res) => {
    let sessionId = req.cookies.session
    if (sessionId) {
        await business.endSession(sessionId)
    }
    res.clearCookie('session')
    res.clearCookie('pending2fa')
    res.redirect('/login?msg=Logged out')
})

app.use(async (req, res, next) => {
    if (req.path === '/login' || req.path === '/2fa' || req.path === '/verify-2fa') {
        next()
        return
    }

    let sessionId = req.cookies.session
    if (!sessionId) {
        res.redirect('/login?msg=You must be logged in')
        return
    }

    let valid = await business.validSession(sessionId)
    if (!valid) {
        res.clearCookie('session')
        res.redirect('/login?msg=Session not valid')
        return
    }

    let validTime = await business.extendSession(sessionId)
    res.cookie('session', sessionId, {
        maxAge: validTime * 1000,
        httpOnly: true
    })
    next()
})

app.get('/', async (req, res) => {
    let empList = await business.getAllEmployees()
    res.render('landing', { empList, layout: undefined })
})

app.get('/employee/:eid', async (req, res) => {
    let employeeDetails = await business.getEmployee(req.params.eid)
    let shifts = await business.getEmployeeShifts(req.params.eid)
    let documents = await business.getEmployeeDocuments(req.params.eid)

    for (let s of shifts) {
        s.startEarly = s.startTime < '12:00'
        s.endEarly = s.endTime < '12:00'
    }

    res.render('single_employee', {
        employeeDetails,
        shifts,
        documents,
        layout: undefined
    })
})

app.get('/edit/:eid', async (req, res) => {
    let employeeDetails = await business.getEmployee(req.params.eid)
    res.render('edit_employee', { employeeDetails, layout: undefined })
})

app.post('/update-employee', async (req, res) => {
    let employeeId = req.body.id
    let employeeName = req.body.name
    let employeePhone = req.body.phone

    if (!employeeId || !employeeName || !employeePhone) {
        res.send("Form inputs invalid....")
        return
    }

    employeeId = employeeId.trim()
    employeeName = employeeName.trim()
    employeePhone = employeePhone.trim()

    if (employeeId === '' || employeeName === '' || employeePhone === '') {
        res.send("Form inputs invalid....")
        return
    }

    let result = await business.updateEmployee({
        employeeId,
        employeeName,
        employeePhone
    })

    if (result === "OK") {
        res.redirect("/")
    }
    else {
        res.send("Error updating employee record")
    }
})

app.post('/upload-document/:eid', function (req, res) {
    upload.single('employeeDocument')(req, res, async function (err) {
        if (err) {
            res.send("Upload failed: " + err.message)
            return
        }

        let employeeId = req.params.eid
        let employee = await business.getEmployee(employeeId)

        if (!employee) {
            res.send("Employee not found")
            return
        }

        let currentCount = await business.countEmployeeDocuments(employeeId)
        if (currentCount >= 5) {
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path)
            }
            res.send("Upload failed: Maximum 5 documents allowed for this employee")
            return
        }

        if (!req.file) {
            res.send("Upload failed: Please choose a PDF file")
            return
        }

        await business.addEmployeeDocument(employeeId, {
            documentId: crypto.randomUUID(),
            originalName: req.file.originalname,
            storedName: req.file.filename,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date().toISOString()
        })

        res.redirect('/employee/' + employeeId)
    })
})

app.get('/document/:eid/:did', async (req, res) => {
    let employeeId = req.params.eid
    let documentId = req.params.did

    let document = await business.getEmployeeDocument(employeeId, documentId)
    if (!document) {
        res.status(404).send("Document not found")
        return
    }

    let fullPath = path.join(uploadFolder, document.storedName)
    res.download(fullPath, document.originalName)
})

app.listen(8000)