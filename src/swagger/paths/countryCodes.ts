/**
 * @openapi
 * /api/country-codes/{code}/states:
 *   get:
 *     tags: [CountryCodes]
 *     summary: List states or provinces for a country
 *     description: Returns subdivisions from the country-state-city dataset, sorted by name. Empty array when the country has no subdivisions in the dataset.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Two-letter ISO country code (case-insensitive)
 *         example: "NG"
 *     responses:
 *       200:
 *         description: Subdivision list (may be empty)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountryStatesResponse'
 *             example:
 *               states:
 *                 - code: "LA"
 *                   name: "Lagos"
 *                 - code: "FC"
 *                   name: "Abuja Federal Capital Territory"
 *       400:
 *         description: Invalid country code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountryCodeInvalid'
 *
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
