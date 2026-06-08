/**
 * @openapi
 * /api/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get admin dashboard stats
 *     description: |
 *       Platform-wide counts for the admin dashboard: users (clients and providers),
 *       active marketplace listings, and paid orders. Requires an authenticated admin session.
 *
 *       Admin accounts are not created via public registration; use env bootstrap or the
 *       `seed:admin` script.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminDashboardStatsResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Failed to load stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/admin/transactions-by-month:
 *   get:
 *     tags: [Admin]
 *     summary: Platform revenue aggregated by month
 *     description: |
 *       Admin only. Returns platform-wide order revenue grouped by `paidAt` month
 *       for a calendar year (UTC), filtered by currency. All paid orders in that
 *       currency count; no provider filter and no FX conversion.
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
 *         description: Monthly revenue breakdown (12 buckets, yearMonth + label + total)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminTransactionsByMonthResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Failed to load transactions by month
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List platform users
 *     description: |
 *       Admin only. Paginated directory of registered users with optional search
 *       (name or email) and role filter. Legacy `patient` accounts are returned
 *       as role `client`.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         example: 20
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Case-insensitive search on first name, last name, or email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [all, client, service_provider, admin]
 *         example: client
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUsersListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Failed to load users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get user detail and transactions
 *     description: Admin only. Returns profile fields plus purchase and sale orders.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserDetailResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *   patch:
 *     tags: [Admin]
 *     summary: Apply admin action on a user
 *     description: |
 *       Admin only. Supported actions: verify, unverify, suspend, unsuspend,
 *       promote_to_provider, demote_to_client.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUserActionRequest'
 *     responses:
 *       200:
 *         description: Updated user detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserDetailResponse'
 *       400:
 *         description: Invalid action or constraint violation
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
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/admin/orders:
 *   get:
 *     tags: [Admin]
 *     summary: List platform orders
 *     description: Admin only. Paginated orders with optional search and line-kind filter.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search receipt number or buyer name/email
 *       - in: query
 *         name: kind
 *         schema:
 *           type: string
 *           enum: [all, sale, hire, book]
 *     responses:
 *       200:
 *         description: Paginated order list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminOrdersListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       403:
 *         description: Not an admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/admin/orders/{orderId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get order detail
 *     description: Admin only. Full receipt with buyer and line items.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Order detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminOrderDetailResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Order not found
 *
 * /api/admin/orders/{orderId}/receipt:
 *   get:
 *     tags: [Admin]
 *     summary: Get order receipt
 *     description: Admin only. Full receipt with line items and photos for any order.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Receipt detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReceiptResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not an admin
 *       404:
 *         description: Receipt not found
 *
 * /api/admin/concierge-requests:
 *   get:
 *     tags: [Admin]
 *     summary: List concierge requests
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, pending, in_progress, resolved]
 *     responses:
 *       200:
 *         description: Paginated concierge requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminConciergeListResponse'
 *
 * /api/admin/concierge-requests/{requestId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get concierge request detail
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Concierge request detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminConciergeDetailResponse'
 *       404:
 *         description: Not found
 *
 * /api/admin/notifications:
 *   get:
 *     tags: [Admin]
 *     summary: List admin notifications
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Notifications list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminNotificationsResponse'
 *
 * /api/admin/notifications/unread-count:
 *   get:
 *     tags: [Admin]
 *     summary: Unread admin notification count
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUnreadNotificationCountResponse'
 *
 * /api/admin/notifications/read-all:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark all admin notifications read
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Marked read
 *
 * /api/admin/notifications/{notificationId}/read:
 *   patch:
 *     tags: [Admin]
 *     summary: Mark one admin notification read
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked read
 *       404:
 *         description: Not found
 */
