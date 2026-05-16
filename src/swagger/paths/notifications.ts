/**
 * @openapi
 * /api/notifications/me:
 *   get:
 *     tags: [Notifications]
 *     summary: List in-app notifications for the current user (client or provider)
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
 *         description: Not a client or provider account
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
 *         description: Not a client or provider account
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
 *         description: Not a client or provider account
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
 *         description: Not a client or provider account
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
 */
