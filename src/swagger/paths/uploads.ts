/**
 * @openapi
 * /api/uploads/service-images:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload service listing images
 *     description: Service provider only. Accepts up to 10 images, max 5MB each. Field name must be `images`. Requires Cloudinary on the server.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (max 10, 5MB each)
 *     responses:
 *       200:
 *         description: Uploaded image URLs (empty urls array if no files sent)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadUrlsResponse'
 *       400:
 *         description: Invalid file type or size/count limits exceeded
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
 *       503:
 *         description: Cloudinary not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: "Image uploads are unavailable: Cloudinary is not configured on the server."
 */
