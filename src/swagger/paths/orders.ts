/**
 * @openapi
 * /api/orders/paystack/config:
 *   get:
 *     tags: [Orders]
 *     summary: Paystack checkout config
 *     description: |
 *       Returns whether Paystack is enabled on the server and the public key for the
 *       client-side inline popup. Public endpoint (no authentication required).
 *     responses:
 *       200:
 *         description: Paystack availability and public key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackConfigResponse'
 *
 * /api/orders/checkout/paystack/initialize:
 *   post:
 *     tags: [Orders]
 *     summary: Initialize sale checkout (Paystack)
 *     description: |
 *       Phase 1 of the cart (sale) checkout. Validates the cart, reserves stock, creates a
 *       pending checkout (30-min TTL) and initializes a Paystack transaction. Returns the
 *       `payment` object used to open the Paystack popup. No order is created until the
 *       payment is verified.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Paystack transaction initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackInitializeResponse'
 *       400:
 *         description: Empty cart, validation error, or amount below Paystack minimum
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
 *         description: Stock conflict or cart issue
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
 * /api/orders/hire-checkout/paystack/initialize:
 *   post:
 *     tags: [Orders]
 *     summary: Initialize hire checkout (Paystack)
 *     description: |
 *       Phase 1 of hire checkout for a single service with a date range. The listing must have
 *       a `hireReturnWindow`. `hireEnd` must fall on an allowed return weekday and within return
 *       hours (Africa/Lagos WAT). Reserves stock, creates a pending checkout and initializes a
 *       Paystack transaction.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HireCheckoutRequest'
 *     responses:
 *       200:
 *         description: Paystack transaction initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackInitializeResponse'
 *       400:
 *         description: Invalid hire dates, service, or quantity
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
 * /api/orders/book-checkout/paystack/initialize:
 *   post:
 *     tags: [Orders]
 *     summary: Initialize personnel booking checkout (Paystack)
 *     description: |
 *       Phase 1 of booking checkout for a single personnel or ambulance-servicing listing.
 *       Requires bookingWindow, price, and pricingPeriod on the listing. Validates free range
 *       and gap between bookings, then initializes a Paystack transaction.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookCheckoutRequest'
 *     responses:
 *       200:
 *         description: Paystack transaction initialized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackInitializeResponse'
 *       400:
 *         description: Invalid booking dates or service
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
 *         description: Time slot conflict
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
 * /api/orders/paystack/verify:
 *   post:
 *     tags: [Orders]
 *     summary: Verify Paystack payment and fulfill order
 *     description: |
 *       Phase 2 of checkout. Verifies the transaction with Paystack using the `reference` from
 *       the initialize step. On success, creates the Order + Receipt, credits seller wallets,
 *       sends notifications, and (for sale) clears the cart. Idempotent: returns the existing
 *       order if the reference was already fulfilled. Response `order.lines[]` includes `photoUrls`.
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
 *                 description: The checkout reference returned by the initialize endpoint.
 *           example:
 *             reference: "AMB-9F2C7A1B4D5E6F708192A3B4"
 *     responses:
 *       201:
 *         description: Payment verified and order fulfilled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaystackVerifyResponse'
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
 *         description: Reference belongs to another account
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
 * /api/orders/paystack/cancel:
 *   post:
 *     tags: [Orders]
 *     summary: Cancel a pending Paystack checkout
 *     description: |
 *       Cancels a pending checkout (e.g. when the user closes the Paystack popup) and releases
 *       any reserved stock for sale/hire checkouts. Idempotent and always returns 204.
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
 *
 * /api/orders/provider/sales-by-month:
 *   get:
 *     tags: [Orders]
 *     summary: Provider sales aggregated by month
 *     description: Service provider only. Returns monthly sales totals for a calendar year (UTC), filtered by currency. Totals sum only this provider's order lines in the selected currency.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         example: 2026
 *       - in: query
 *         name: currency
 *         required: false
 *         schema:
 *           type: string
 *           enum: [NGN, GHS]
 *         example: NGN
 *     responses:
 *       200:
 *         description: Monthly sales breakdown (12 buckets, yearMonth + label + total)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderSalesByMonthResponse'
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
 * /api/orders/provider/sales:
 *   get:
 *     tags: [Orders]
 *     summary: Provider sale orders
 *     description: |
 *       Service provider only. Returns one row per qualifying sale line on the provider's
 *       listings, sorted by paidAt descending (most recent first).
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Sale orders list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderSalesResponse'
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
 * /api/orders/provider/bookings:
 *   get:
 *     tags: [Orders]
 *     summary: Provider personnel bookings
 *     description: Service provider only. One row per book line on the provider's listings.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Personnel bookings list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bookings:
 *                   type: array
 *                   items:
 *                     type: object
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
 * /api/orders/provider/hire-bookings:
 *   get:
 *     tags: [Orders]
 *     summary: Provider hire bookings
 *     description: Service provider only. One row per qualifying hire line on the provider's listings.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Hire bookings list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProviderHireBookingsResponse'
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
 * /api/orders/me:
 *   get:
 *     tags: [Orders]
 *     summary: List my orders
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User's order summaries (newest first, up to 100)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/orders/me/{orderId}:
 *   get:
 *     tags: [Orders]
 *     summary: Get one of my orders
 *     description: |
 *       Returns full order detail for the authenticated client.
 *       Each line item includes `photoUrls`: all photo URLs from the live service listing
 *       (`Service.photoUrls`). Returns an empty array when the listing no longer exists or has no photos.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439030"
 *     responses:
 *       200:
 *         description: Order detail with line items (each line includes `photoUrls`)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrderResponse'
 *       400:
 *         description: Invalid orderId
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
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
