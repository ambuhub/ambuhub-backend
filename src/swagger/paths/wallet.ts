/**
 * @openapi
 * /api/wallet/me:
 *   get:
 *     tags: [Wallet]
 *     summary: Get my wallet (provider)
 *     description: Returns balanceNgn and currency for the authenticated service provider.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WalletResponse'
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
 */
