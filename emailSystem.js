/**
 * Send a generic email.
 * For this assignment the email is only logged to the console.
 *
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} body
 */
async function sendEmail(toEmail, subject, body) {
    console.log("--------------------------------------------------")
    console.log("EMAIL SENT")
    console.log("TO:", toEmail)
    console.log("SUBJECT:", subject)
    console.log("BODY:")
    console.log(body)
    console.log("--------------------------------------------------")
}

/**
 * Send a 2FA code email.
 *
 * @param {string} toEmail
 * @param {string} code
 */
async function sendTwoFactorCode(toEmail, code) {
    await sendEmail(
        toEmail,
        "Your 2FA Code",
        "Your verification code is: " + code + "\nThis code expires in 3 minutes."
    )
}

/**
 * Send a suspicious activity warning email.
 *
 * @param {string} toEmail
 */
async function sendSuspiciousActivityEmail(toEmail) {
    await sendEmail(
        toEmail,
        "Suspicious Activity Warning",
        "There have been multiple invalid login attempts on your account."
    )
}

/**
 * Send an account locked email.
 *
 * @param {string} toEmail
 */
async function sendAccountLockedEmail(toEmail) {
    await sendEmail(
        toEmail,
        "Account Locked",
        "Your account has been locked after too many invalid login attempts."
    )
}

module.exports = {
    sendEmail,
    sendTwoFactorCode,
    sendSuspiciousActivityEmail,
    sendAccountLockedEmail
}