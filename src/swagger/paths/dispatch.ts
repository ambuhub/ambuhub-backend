/**
 * @openapi
 * /api/dispatch/requests:
 *   post:
 *     tags: [Dispatch]
 *     summary: Create an ambulance dispatch request
 *     description: Client submits a pickup location. Backend finds the nearest on-duty ground ambulance and offers the request (4-minute accept window).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [locationSource]
 *             properties:
 *               locationSource:
 *                 type: string
 *                 enum: [current_location, address]
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dispatch request created
 *       409:
 *         description: Client already has an active request
 *       429:
 *         description: Rate limit exceeded (max in-flight search/offered requests per hour; see DISPATCH_MAX_REQUESTS_PER_HOUR)
 *
 * /api/dispatch/requests/me/active:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get client's active dispatch request
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active request or null
 *
 * /api/dispatch/requests/me/history:
 *   get:
 *     tags: [Dispatch]
 *     summary: List client's dispatch history
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Past dispatch requests
 *
 * /api/dispatch/requests/{id}:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get dispatch request by id
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dispatch request details
 *
 * /api/dispatch/requests/{id}/cancel:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Cancel or dismiss a dispatch request
 *     description: Client may cancel while searching, offered, or accepted (not en route). Also dismisses failed requests (no_provider, expired).
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request cancelled
 *
 * /api/dispatch/requests/{id}/route:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get route polyline for an accepted dispatch
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Encoded polyline and ETA
 *
 * /api/dispatch/provider/offer:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get provider's current pending offer
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pending offer or null
 *
 * /api/dispatch/provider/requests:
 *   get:
 *     tags: [Dispatch]
 *     summary: List all dispatch requests assigned to the provider
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Assigned dispatch requests (newest first)
 *
 * /api/dispatch/provider/services:
 *   get:
 *     tags: [Dispatch]
 *     summary: List provider ground ambulance listings for dispatch
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dispatch-eligible services
 *
 * /api/dispatch/requests/{id}/accept:
 *   post:
 *     tags: [Dispatch]
 *     summary: Accept a dispatch offer
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offer accepted
 *       409:
 *         description: Offer expired
 *
 * /api/dispatch/requests/{id}/reject:
 *   post:
 *     tags: [Dispatch]
 *     summary: Reject a dispatch offer
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Offer rejected; cascades to next ambulance
 *
 * /api/dispatch/requests/{id}/arrived:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Mark ambulance arrived at pickup
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Arrival recorded
 *
 * /api/dispatch/services/{serviceId}/dispatch:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Toggle on-duty status for a ground ambulance listing
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dispatchEnabled]
 *             properties:
 *               dispatchEnabled:
 *                 type: boolean
 *               latitude:
 *                 type: number
 *                 description: Required when enabling dispatch unless a fresh live location already exists
 *               longitude:
 *                 type: number
 *                 description: Required when enabling dispatch unless a fresh live location already exists
 *     responses:
 *       200:
 *         description: Dispatch status updated
 *       400:
 *         description: Location required when enabling dispatch (no fresh liveLocation on listing)
 *   patch:
 *     tags: [Dispatch]
 *     summary: Update live ambulance GPS (call every 5–10s while on duty)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       204:
 *         description: Location updated
 */
