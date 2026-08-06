/**
 * @openapi
 * /api/dispatch/requests:
 *   post:
 *     tags: [Dispatch]
 *     summary: Create an ambulance dispatch request
 *     description: |
 *       Client submits a pickup location. Backend geocodes address input or reverse-geocodes GPS,
 *       finds the nearest on-duty ground ambulance with fresh live location, and offers the request
 *       (4-minute accept window by default; see `DISPATCH_OFFER_TIMEOUT_MS`).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/DispatchCreateRequestCurrentLocation'
 *               - $ref: '#/components/schemas/DispatchCreateRequestAddress'
 *           examples:
 *             current_location:
 *               summary: GPS pickup
 *               value:
 *                 locationSource: current_location
 *                 latitude: 6.5244
 *                 longitude: 3.3792
 *                 notes: "Patient conscious, chest pain"
 *             address:
 *               summary: Address pickup (server geocodes with Nigeria bias)
 *               value:
 *                 locationSource: address
 *                 address: "12 Admiralty Way, Lekki, Lagos"
 *                 notes: "Gate 2, blue building"
 *     responses:
 *       201:
 *         description: Dispatch request created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
 *       400:
 *         description: Missing/invalid location or geocoding failed
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
 *         description: Not a client account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       409:
 *         description: Client already has an active dispatch request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchConflictResponse'
 *       429:
 *         description: Rate limit exceeded (max in-flight `searching`/`offered` requests per hour; see `DISPATCH_MAX_REQUESTS_PER_HOUR`)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/me/active:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get client's active dispatch request
 *     description: Returns the newest request in an active status (`searching`, `offered`, `accepted`, `en_route`), or `null`.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active request or null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchActiveRequestResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a client account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/me/history:
 *   get:
 *     tags: [Dispatch]
 *     summary: List client's dispatch history
 *     description: Returns past dispatch requests for the authenticated client, newest first.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Past dispatch requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a client account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/{id}:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get dispatch request by id
 *     description: Client may read own requests; assigned provider may read assigned requests; admins may read any.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Dispatch request MongoDB id
 *     responses:
 *       200:
 *         description: Dispatch request details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
 *       400:
 *         description: Invalid request id
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
 *         description: Not authorized to view this request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Dispatch request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/{id}/cancel:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Cancel or dismiss a dispatch request
 *     description: |
 *       Client may cancel while status is `searching`, `offered`, or `accepted`.
 *       Also dismisses terminal failed states (`no_provider`, `expired`).
 *       Cannot cancel after status `en_route`.
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
 *         description: Request cancelled or dismissed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
 *       400:
 *         description: Invalid request id or cannot cancel after en route
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
 *         description: Not a client account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Dispatch request not found or not cancellable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/{id}/route:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get route polyline for an accepted dispatch
 *     description: Returns encoded driving route from ambulance to pickup after accept. Same auth rules as GET `/requests/{id}`.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRouteResponse'
 *       400:
 *         description: Invalid request id
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
 *         description: Not authorized to view this request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Route not available for this request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/provider/offer:
 *   get:
 *     tags: [Dispatch]
 *     summary: Get provider's current pending offer
 *     description: Returns the nearest-expiring active offer for the authenticated provider, or `null`. Poll every ~5s while on duty.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pending offer or null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchOfferResponse'
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
 * /api/dispatch/provider/requests:
 *   get:
 *     tags: [Dispatch]
 *     summary: List all dispatch requests assigned to the provider
 *     description: Returns up to 50 assigned requests (incoming, active, completed), newest first.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Assigned dispatch requests (newest first)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestListResponse'
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
 * /api/dispatch/provider/services:
 *   get:
 *     tags: [Dispatch]
 *     summary: List provider ground ambulance listings for dispatch
 *     description: Only **Medical transport → Ground Ambulance** listings are returned.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dispatch-eligible services
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchServiceListResponse'
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
 * /api/dispatch/requests/{id}/accept:
 *   post:
 *     tags: [Dispatch]
 *     summary: Accept a dispatch offer
 *     description: Provider accepts within the offer window. Computes driving route and transitions to `accepted` (then `en_route` after first location ping).
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
 *         description: Offer accepted; response includes route polyline
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
 *       400:
 *         description: Invalid request id or ambulance location unavailable
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
 *       409:
 *         description: Offer expired or not found for this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/{id}/reject:
 *   post:
 *     tags: [Dispatch]
 *     summary: Reject a dispatch offer
 *     description: Provider declines the offer; backend cascades to the next nearest eligible ambulance.
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
 *         description: Offer rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
 *       400:
 *         description: Invalid request id
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
 *         description: Offer not found for this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/requests/{id}/arrived:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Mark ambulance arrived at pickup
 *     description: Provider marks arrival when status is `accepted` or `en_route`. Notifies the client.
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchRequestResponse'
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
 *         description: Active dispatch not found for this provider
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/dispatch/services/{serviceId}/dispatch:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Toggle on-duty status for a ground ambulance listing
 *     description: |
 *       When enabling dispatch (`dispatchEnabled: true`), include current GPS coordinates **or** ensure
 *       a fresh live location was saved within the last 5 minutes (`DISPATCH_LOCATION_STALE_MS`).
 *       Disabling clears live location from the listing.
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
 *             $ref: '#/components/schemas/DispatchStatusPatchRequest'
 *           examples:
 *             enable:
 *               summary: Go on duty with GPS
 *               value:
 *                 dispatchEnabled: true
 *                 latitude: 9.0765
 *                 longitude: 7.3986
 *             disable:
 *               summary: Go off duty
 *               value:
 *                 dispatchEnabled: false
 *     responses:
 *       200:
 *         description: Dispatch status updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DispatchStatusUpdateResponse'
 *       400:
 *         description: Invalid service id or location required when enabling dispatch
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
 *
 * /api/dispatch/services/{serviceId}/location:
 *   patch:
 *     tags: [Dispatch]
 *     summary: Update live ambulance GPS
 *     description: |
 *       Call every 5–10 seconds while on duty. Required while `dispatchEnabled: true`.
 *       First ping after accept transitions the assigned request from `accepted` to `en_route`.
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
 *             $ref: '#/components/schemas/DispatchLocationPatchRequest'
 *     responses:
 *       204:
 *         description: Location updated
 *       400:
 *         description: Valid latitude and longitude are required
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
 *         description: On-duty ground ambulance listing not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
