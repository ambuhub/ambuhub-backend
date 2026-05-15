/**
 * @openapi
 * /api/receipts/me:
 *   get:
 *     tags: [Receipts]
 *     summary: List my receipts
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User's receipt summaries (newest first, up to 100)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReceiptListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *
 * /api/receipts/me/by-order/{orderId}:
 *   get:
 *     tags: [Receipts]
 *     summary: Get receipt by order ID
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
 *         description: Receipt with line items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReceiptResponse'
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
 *         description: Receipt not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
