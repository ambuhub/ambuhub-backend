/**
 * @openapi
 * /api/services/marketplace:
 *   get:
 *     tags: [Services]
 *     summary: List marketplace services
 *     parameters:
 *       - in: query
 *         name: categorySlug
 *         required: false
 *         schema:
 *           type: string
 *         description: Filter by service category slug; when set, bannerUrl may come from the category
 *         example: "medical-transport"
 *     responses:
 *       200:
 *         description: Marketplace listings (up to 200, available only)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarketplaceListResponse'
 *       400:
 *         description: Invalid categorySlug query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Service category not found (when categorySlug provided)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/marketplace/{serviceId}:
 *   get:
 *     tags: [Services]
 *     summary: Get marketplace service by ID
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Service detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
 *       400:
 *         description: Invalid serviceId
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Service not found or not available
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/marketplace/{serviceId}/booking-availability:
 *   get:
 *     tags: [Services]
 *     summary: Booking availability for a book listing
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Busy and free ranges for the window
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingAvailabilityResponse'
 *       400:
 *         description: Invalid parameters or not a book listing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/me/{serviceId}/booking-settings:
 *   patch:
 *     tags: [Services]
 *     summary: Update booking schedule and pricing (provider)
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
 *             $ref: '#/components/schemas/BookingSettingsPatch'
 *     responses:
 *       200:
 *         description: Updated service
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
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
 *         description: Not owner or not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/favorites/me:
 *   get:
 *     tags: [Services]
 *     summary: List my favorite marketplace listings
 *     description: Returns available marketplace services in most-recently-added order. Stale IDs are pruned.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Favorite listings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   post:
 *     tags: [Services]
 *     summary: Add a marketplace listing to favorites
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [serviceId]
 *             properties:
 *               serviceId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Full favorites list after add (most recent first)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceListResponse'
 *       400:
 *         description: Missing serviceId, invalid id, or favorites limit reached
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
 *         description: Listing not found or not available on the marketplace
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/favorites/me/{serviceId}:
 *   delete:
 *     tags: [Services]
 *     summary: Remove a listing from favorites
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Favorites list after removal
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceListResponse'
 *       400:
 *         description: Invalid serviceId
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
 * /api/services/me:
 *   get:
 *     tags: [Services]
 *     summary: List my services (provider)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Provider's services
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceListResponse'
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
 * /api/services/me/{serviceId}:
 *   get:
 *     tags: [Services]
 *     summary: Get one of my services (provider)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Service detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
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
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services:
 *   post:
 *     tags: [Services]
 *     summary: Create a service (provider)
 *     description: |
 *       `countryCode`, `stateProvince`, and `officeAddress` are required on create.
 *       For `listingType: hire`, `hireReturnWindow` (return days and hours in WAT) and `pricingPeriod` are also required.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceUpsert'
 *     responses:
 *       201:
 *         description: Service created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
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
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/{id}/availability:
 *   patch:
 *     tags: [Services]
 *     summary: Set service availability (provider)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AvailabilityPatch'
 *     responses:
 *       200:
 *         description: Service updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
 *       400:
 *         description: isAvailable must be boolean
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
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/services/{id}:
 *   put:
 *     tags: [Services]
 *     summary: Update a service (provider)
 *     description: |
 *       Location fields are optional on update. Omit them to leave existing values unchanged,
 *       or send `countryCode`, `stateProvince`, and `officeAddress` together to add or update location.
 *       `hireReturnWindow` is optional on update (legacy hire listings); send it to set or change return schedule.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ServiceUpsert'
 *     responses:
 *       200:
 *         description: Service updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ServiceResponse'
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
 *         description: Not a service provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   delete:
 *     tags: [Services]
 *     summary: Delete a service (provider)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439012"
 *     responses:
 *       204:
 *         description: Service deleted (no response body)
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
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
