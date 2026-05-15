/**
 * @openapi
 * /api/country-codes/{code}:
 *   get:
 *     tags: [CountryCodes]
 *     summary: Verify ISO country code
 *     description: Returns whether the code is a valid ISO 3166-1 alpha-2 country code.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Two-letter country code (case-insensitive)
 *         example: "NG"
 *     responses:
 *       200:
 *         description: Valid country code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountryCodeValid'
 *       400:
 *         description: Invalid country code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountryCodeInvalid'
 */
