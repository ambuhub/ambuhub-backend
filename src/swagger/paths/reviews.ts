/**
 * @openapi
 * /api/reviews/by-service/{serviceId}:
 *   get:
 *     tags: [Reviews]
 *     summary: List reviews and rating summary for a listing
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Public reviews for the listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceReviewsResponse'
 *       400:
 *         description: Invalid serviceId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/reviews/me:
 *   get:
 *     tags: [Reviews]
 *     summary: List reviews written by the current user
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User's reviews
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReviewListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/reviews/me/eligible:
 *   get:
 *     tags: [Reviews]
 *     summary: List purchases/hires the user can still review
 *     description: Sale lines are eligible after payment. Hire lines are eligible after hireEnd.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Eligible review targets
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EligibleReviewListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Submit a verified review for an order line
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReviewCreateInput'
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReviewResponse'
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
 *         description: Not eligible to review yet (e.g. hire not ended)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Order or line not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Already reviewed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
