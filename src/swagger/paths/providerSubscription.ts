/**
 * @openapi
 * /api/provider/subscription:
 *   get:
 *     tags: [ProviderSubscription]
 *     summary: Get provider subscription status
 *     description: |
 *       Service provider only. Returns the current subscription plan, billing interval,
 *       expiry date, and whether premium is active. Expired premium subscriptions are
 *       normalized to the free plan on read.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current subscription status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderSubscriptionResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/provider/subscription/paystack/initialize:
 *   post:
 *     tags: [ProviderSubscription]
 *     summary: Initialize premium subscription checkout (Paystack)
 *     description: |
 *       Service provider only. Phase 1 of premium subscription checkout. Creates a pending
 *       checkout (30-min TTL) and initializes a Paystack transaction for the selected
 *       billing interval. Pricing is based on the provider account country (NGN for Nigeria,
 *       GHS for Ghana).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProviderSubscriptionInitializeRequest'
 *     responses:
 *       200:
 *         description: Paystack transaction initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackInitializeResponse'
 *       400:
 *         description: Invalid interval or amount below Paystack minimum
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
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       422:
 *         description: Currency not supported by the Paystack merchant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       502:
 *         description: Paystack could not initialize the payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       503:
 *         description: Paystack is not configured on the server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/provider/subscription/paystack/verify:
 *   post:
 *     tags: [ProviderSubscription]
 *     summary: Verify premium subscription payment (Paystack)
 *     description: |
 *       Service provider only. Phase 2 of subscription checkout. Verifies the Paystack
 *       transaction and activates or extends premium until the end of the billing period.
 *       Idempotent when the reference was already fulfilled.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference]
 *             properties:
 *               reference:
 *                 type: string
 *                 description: Checkout reference from the initialize step.
 *           example:
 *             reference: "AMB-9F2C7A1B4D5E6F708192A3B4"
 *     responses:
 *       200:
 *         description: Subscription activated or already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderSubscriptionVerifyResponse'
 *       400:
 *         description: Missing reference or paid amount mismatch
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
 *       402:
 *         description: Payment was not successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Checkout session not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Checkout session no longer active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       410:
 *         description: Checkout session expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       502:
 *         description: Paystack could not verify the payment
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/provider/subscription/paystack/cancel:
 *   post:
 *     tags: [ProviderSubscription]
 *     summary: Cancel a pending subscription checkout
 *     description: |
 *       Service provider only. Cancels a pending subscription checkout (e.g. when the user
 *       closes the Paystack popup). Idempotent and always returns 204.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reference]
 *             properties:
 *               reference:
 *                 type: string
 *           example:
 *             reference: "AMB-9F2C7A1B4D5E6F708192A3B4"
 *     responses:
 *       204:
 *         description: Pending checkout cancelled (or already inactive)
 *       400:
 *         description: Missing reference
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
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
