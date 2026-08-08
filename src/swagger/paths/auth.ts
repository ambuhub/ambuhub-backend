/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: |
 *       Creates a client or service provider account, sets the session cookie, and
 *       emails a 6-digit OTP (`purpose: verify_email`). The session is issued with
 *       `emailVerified: false`; complete `POST /api/auth/verify-email` before dashboards.
 *       Admin accounts cannot be created through this endpoint.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/RegisterRequestClient'
 *               - $ref: '#/components/schemas/RegisterRequestProvider'
 *           examples:
 *             client:
 *               summary: Client registration
 *               value:
 *                 firstName: "Jane"
 *                 lastName: "Doe"
 *                 email: "jane@example.com"
 *                 phone: "+2348000000000"
 *                 countryCode: "NG"
 *                 password: "SecurePass123!"
 *                 role: "client"
 *                 dateOfBirth: "1990-01-15"
 *             service_provider:
 *               summary: Service provider registration
 *               value:
 *                 firstName: "Acme"
 *                 lastName: "Medical"
 *                 email: "provider@example.com"
 *                 phone: "+2348000000001"
 *                 countryCode: "NG"
 *                 password: "SecurePass123!"
 *                 role: "service_provider"
 *                 businessName: "Acme Ambulance Services"
 *                 physicalAddress: "12 Hospital Road, Lagos"
 *                 website: "https://acme.example.com"
 *     responses:
 *       201:
 *         description: User created; session cookie set; verification OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSessionWithOtpResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: OTP email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in (clients and service providers)
 *     description: |
 *       Authenticates with email/password and sets the session cookie.
 *       Admin accounts are rejected here and must use `POST /api/auth/admin/login`.
 *
 *       **Unverified accounts:** login still succeeds, but the response includes
 *       `requiresEmailVerification: true` and a fresh OTP. Call
 *       `POST /api/auth/verify-email` (or resend via `/verify-email/resend`) before
 *       accessing client/provider dashboards.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful; session cookie set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSessionWithOtpResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Suspended account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: OTP email delivery failed (unverified login path)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/admin/login:
 *   post:
 *     tags: [Auth]
 *     summary: Admin portal log in
 *     description: |
 *       Authenticates an admin account only and sets the session cookie.
 *       Non-admin credentials receive a generic invalid credentials response.
 *       Admins do not use the email verification OTP flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful; session cookie set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       401:
 *         description: Invalid credentials or not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Suspended account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out
 *     description: Clears the session cookie.
 *     responses:
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkResponse'
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password-reset OTP
 *     description: |
 *       **Forgot-password flow (step 1 of 4)**
 *
 *       1. `POST /api/auth/forgot-password` — send OTP to email
 *       2. `POST /api/auth/forgot-password/resend` — optional resend (90s cooldown)
 *       3. `POST /api/auth/forgot-password/verify` — exchange OTP for `resetToken`
 *       4. `POST /api/auth/forgot-password/reset` — set new password with `resetToken`
 *
 *       Sends a 6-digit OTP (`purpose: reset_password`) when a non-admin account exists.
 *       Always returns a generic success message to avoid email enumeration.
 *       Codes expire after 15 minutes.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP request accepted (generic message whether or not the email exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForgotPasswordResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Resend cooldown active for an existing pending OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/forgot-password/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Resend password-reset OTP
 *     description: |
 *       **Forgot-password flow (step 2, optional)**
 *       Resends a `reset_password` OTP to the same email. Limited to once every 90 seconds.
 *       Uses the same anti-enumeration response shape as the initial request.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP resent (or generic success if no account)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForgotPasswordResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Resend cooldown active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/forgot-password/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password-reset OTP
 *     description: |
 *       **Forgot-password flow (step 3 of 4)**
 *       Validates the 6-digit code emailed to the user and returns a short-lived
 *       `resetToken` for `POST /api/auth/forgot-password/reset`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordVerifyRequest'
 *     responses:
 *       200:
 *         description: OTP verified; use resetToken to set a new password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForgotPasswordVerifyResponse'
 *       400:
 *         description: Invalid, expired, or missing code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/forgot-password/reset:
 *   post:
 *     tags: [Auth]
 *     summary: Set new password after OTP verification
 *     description: |
 *       **Forgot-password flow (step 4 of 4)**
 *       Sets a new password using the `resetToken` from verify. Does not change the
 *       session cookie; the user should log in afterward with the new password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordResetRequest'
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkMessageResponse'
 *       400:
 *         description: Invalid reset session or password validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current session user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   patch:
 *     tags: [Auth]
 *     summary: Update profile
 *     description: |
 *       Updates the authenticated user's profile. Email and role cannot be changed here
 *       (use the change-email OTP flow for email).
 *       - **client**: send `UpdateClientProfileRequest` (includes dateOfBirth).
 *       - **service_provider**: send `UpdateProviderProfileRequest` (business fields).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/UpdateClientProfileRequest'
 *               - $ref: '#/components/schemas/UpdateProviderProfileRequest'
 *     responses:
 *       200:
 *         description: Updated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Wrong account type for this profile update
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: User or provider profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/verify-email:
 *   get:
 *     tags: [Auth]
 *     summary: Get email verification OTP status
 *     description: |
 *       **Signup / login verification flow**
 *
 *       1. Register or log in while unverified → OTP emailed (`verify_email`)
 *       2. `GET /api/auth/verify-email` — load status / cooldown for the UI
 *       3. `POST /api/auth/verify-email` — submit the 6-digit code
 *       4. `POST /api/auth/verify-email/resend` — resend (90s cooldown)
 *
 *       Returns whether the account is already verified and, if not, the active OTP
 *       expiry and resend cooldown. Requires an authenticated session cookie.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Verification status and resend cooldown
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyEmailStatusResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   post:
 *     tags: [Auth]
 *     summary: Verify email with OTP
 *     description: |
 *       Validates the 6-digit `verify_email` code sent at signup/login, marks
 *       `emailVerified: true`, and refreshes the session cookie (JWT includes the
 *       updated verification flag).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyEmailRequest'
 *     responses:
 *       200:
 *         description: Email verified; session cookie refreshed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Invalid, expired, or missing code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/verify-email/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Resend email verification OTP
 *     description: |
 *       Sends a new 6-digit `verify_email` code to the account's current email.
 *       Limited to once every 90 seconds. Rejected if the email is already verified
 *       or the account is an admin.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OtpEnvelopeResponse'
 *       400:
 *         description: Already verified or not applicable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Resend cooldown active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/change-email:
 *   post:
 *     tags: [Auth]
 *     summary: Request email change OTP
 *     description: |
 *       **Change-email flow (authenticated profile)**
 *
 *       1. `POST /api/auth/change-email` — confirm current password + new email → OTP to **new** address
 *       2. `POST /api/auth/change-email/resend` — optional resend (90s cooldown; no password again)
 *       3. `POST /api/auth/change-email/verify` — submit code → account email updated + session refreshed
 *
 *       The session email is unchanged until verify succeeds. Codes expire after 15 minutes.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangeEmailRequest'
 *     responses:
 *       200:
 *         description: OTP sent to the new email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChangeEmailOtpResponse'
 *       400:
 *         description: Validation error (same email, missing fields, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated or password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Resend cooldown active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/change-email/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify new email with OTP
 *     description: |
 *       Validates the `change_email` OTP sent to the pending new address, updates
 *       the account email, sets `emailVerified: true`, and refreshes the session cookie.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangeEmailVerifyRequest'
 *     responses:
 *       200:
 *         description: Email updated; session cookie refreshed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Invalid, expired, or missing code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/change-email/resend:
 *   post:
 *     tags: [Auth]
 *     summary: Resend email change OTP
 *     description: |
 *       Resends a `change_email` code to the pending new email from the active OTP.
 *       Does not require the password again. Limited to once every 90 seconds.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OtpEnvelopeResponse'
 *       400:
 *         description: No pending email change
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Pending email already taken by another account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       429:
 *         description: Resend cooldown active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Email delivery failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 *     description: Verifies the current password, then sets a new password. Session cookie remains valid.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OkMessageResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       401:
 *         description: Not authenticated or current password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
