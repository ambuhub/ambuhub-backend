/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Creates a client or service provider account and sets the session cookie.
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
 *         description: User created; session cookie set
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
 *       409:
 *         description: Email already registered
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
 *     summary: Log in
 *     description: Authenticates with email/password and sets the session cookie.
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
 *         description: Invalid credentials
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
 *     summary: Reset password without OTP
 *     description: Updates password for the given email if an account exists (no email verification in current version).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset attempted
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
 *       Updates the authenticated user's profile. Email and role cannot be changed.
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
