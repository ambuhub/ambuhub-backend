/**
 * @openapi
 * /api/marketplace/country:
 *   get:
 *     tags: [Marketplace]
 *     summary: Resolve marketplace browse country
 *     description: |
 *       Public endpoint. Returns the marketplace country code (NG or GH) used for browse
 *       defaults. Resolution order: explicit `countryCode` query param (when NG/GH), then
 *       geo headers (`CF-IPCountry`, `X-Vercel-IP-Country`), then the country with the most
 *       active listings.
 *     parameters:
 *       - in: query
 *         name: countryCode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [NG, GH]
 *         description: Optional override when the client already knows the browse country.
 *     responses:
 *       200:
 *         description: Resolved marketplace country
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MarketplaceCountryResponse'
 */
