/**
 * @openapi
 * /api/provider/dispatch-accounts:
 *   get:
 *     tags: [ProviderDispatchAccounts]
 *     summary: List dispatch accounts for the logged-in provider
 *     description: |
 *       Returns every `dispatch` crew user owned by this service provider, with linked listing
 *       duty status and any active request summary. Role: `service_provider`.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dispatch accounts with duty and request status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderDispatchAccountListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a service provider account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   post:
 *     tags: [ProviderDispatchAccounts]
 *     summary: Create a dispatch crew account linked to a ground-ambulance listing
 *     description: |
 *       Creates a `dispatch` user linked **1:1** to one Ground Ambulance listing.
 *       - Email is marked verified (no OTP signup for crew).
 *       - That listing is excluded from hire marketplace once linked.
 *       - Role: `service_provider`.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProviderDispatchAccountRequest'
 *     responses:
 *       201:
 *         description: Dispatch account created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderDispatchAccountResponse'
 *       400:
 *         description: Validation error (missing fields, weak password, invalid country)
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
 *         description: Not a service provider account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Ground ambulance listing not found for this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Email already taken, or listing already linked to a dispatch account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/provider/dispatch-accounts/available-listings:
 *   get:
 *     tags: [ProviderDispatchAccounts]
 *     summary: Ground ambulance listings not yet linked to a dispatch account
 *     description: |
 *       Use this list when creating a new crew account (`serviceId` must come from here).
 *       Role: `service_provider`.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unlinked ground-ambulance listings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderDispatchAvailableListingsResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a service provider account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/provider/dispatch-accounts/{id}:
 *   patch:
 *     tags: [ProviderDispatchAccounts]
 *     summary: Enable or disable a dispatch account
 *     description: |
 *       When `isDisabled` is `true`, the crew cannot log in and the linked listing is taken off duty
 *       (dispatchEnabled cleared, live location cleared). Role: `service_provider`.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Dispatch user id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PatchProviderDispatchAccountRequest'
 *     responses:
 *       200:
 *         description: Updated account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderDispatchAccountResponse'
 *       400:
 *         description: Invalid id or isDisabled missing / not a boolean
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
 *         description: Not a service provider account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Dispatch account not found for this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
