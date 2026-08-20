/**
 * @openapi
 * /api/notifications/me:
 *   get:
 *     tags: [Notifications]
 *     summary: List in-app notifications for the current user (client, provider, or dispatch)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: date-time
 *         description: ISO8601 createdAt of the last item from the previous page (newest-first pagination)
 *     responses:
 *       200:
 *         description: Notifications for the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a client, provider, or dispatch account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/notifications/me/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Unread notification count for sidebar badge
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationUnreadCountResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a client, provider, or dispatch account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/notifications/me/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Count of notifications marked read
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationMarkAllReadResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not a client, provider, or dispatch account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/notifications/me/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark one notification as read
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
 *         description: Updated notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationReadResponse'
 *       400:
 *         description: Invalid notification id
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
 *         description: Not a client, provider, or dispatch account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Notification not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/notifications/me/devices:
 *   put:
 *     tags: [Notifications]
 *     summary: Register or update an FCM device token
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken, platform]
 *             properties:
 *               fcmToken:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, android, ios]
 *               deviceName:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registered device token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTokenResponse'
 *       401:
 *         description: Not authenticated
 *   delete:
 *     tags: [Notifications]
 *     summary: Remove an FCM device token (e.g. on logout)
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Token removed
 *       401:
 *         description: Not authenticated
 *
 * /api/notifications/me/devices/refresh:
 *   patch:
 *     tags: [Notifications]
 *     summary: Refresh an FCM token after Firebase rotation
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newToken, platform]
 *             properties:
 *               oldToken:
 *                 type: string
 *               newToken:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, android, ios]
 *               deviceName:
 *                 type: string
 *               appVersion:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated device token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeviceTokenResponse'
 *       401:
 *         description: Not authenticated
 */
