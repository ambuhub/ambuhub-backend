/**
 * @openapi
 * /api/orders/checkout/simulate-paystack:
 *   post:
 *     tags: [Orders]
 *     summary: Simulate sale checkout (Paystack)
 *     description: Checks out the current user's cart as a simulated Paystack payment (sale items).
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimulateCheckoutResponse'
 *       400:
 *         description: Empty cart or validation error
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
 *
 * /api/orders/hire-checkout/simulate-paystack:
 *   post:
 *     tags: [Orders]
 *     summary: Simulate hire checkout (Paystack)
 *     description: |
 *       Creates a hire order for a single service with a date range.
 *       The listing must have a `hireReturnWindow`. `hireEnd` must fall on an allowed return
 *       weekday and within return hours (Africa/Lagos WAT); daily+ periods use `timeEnd` on
 *       the selected return date.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HireCheckoutRequest'
 *     responses:
 *       201:
 *         description: Hire order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimulateCheckoutResponse'
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
 *
 * /api/orders/book-checkout/simulate-paystack:
 *   post:
 *     tags: [Orders]
 *     summary: Simulate personnel booking checkout (Paystack)
 *     description: |
 *       Creates a book order for a single personnel or ambulance-servicing listing.
 *       Requires bookingWindow, price, and pricingPeriod on the listing. Validates
 *       free range and gap between bookings.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BookCheckoutRequest'
 *     responses:
 *       201:
 *         description: Book order created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SimulateCheckoutResponse'
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
 *
 * /api/orders/provider/sales-by-month:
 *   get:
 *     tags: [Orders]
 *     summary: Provider sales aggregated by month
 *     description: Service provider only. Returns monthly sales totals for a calendar year (UTC).
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
 *     responses:
 *       200:
 *         description: Monthly sales breakdown (12 buckets, yearMonth + label + totalNgn)
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
 *         description: Order detail with line items
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
