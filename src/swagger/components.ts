/**
 * @openapi
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: ambuhub_access_token
 *       description: JWT session cookie set by POST /api/auth/login or /api/auth/register
 *
 *   schemas:
 *     ErrorMessage:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *       example:
 *         message: "Invalid credentials"
 *
 *     OkResponse:
 *       type: object
 *       properties:
 *         ok:
 *           type: boolean
 *       example:
 *         ok: true
 *
 *     UserRole:
 *       type: string
 *       enum: [client, service_provider]
 *
 *     ListingType:
 *       type: string
 *       enum: [sale, hire, book]
 *       nullable: true
 *
 *     PricingPeriod:
 *       type: string
 *       enum: [hourly, daily, weekly, monthly, yearly]
 *       nullable: true
 *
 *     PublicUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         role:
 *           $ref: '#/components/schemas/UserRole'
 *         emailVerified:
 *           type: boolean
 *         dateOfBirth:
 *           type: string
 *           nullable: true
 *           description: ISO date YYYY-MM-DD (clients)
 *         phone:
 *           type: string
 *         countryCode:
 *           type: string
 *           description: ISO 3166-1 alpha-2
 *         businessName:
 *           type: string
 *         physicalAddress:
 *           type: string
 *         website:
 *           type: string
 *           nullable: true
 *       example:
 *         id: "507f1f77bcf86cd799439011"
 *         firstName: "Jane"
 *         lastName: "Doe"
 *         email: "jane@example.com"
 *         role: "client"
 *         emailVerified: false
 *         dateOfBirth: "1990-01-15"
 *         phone: "+2348000000000"
 *         countryCode: "NG"
 *
 *     RegisterRequestClient:
 *       type: object
 *       required: [firstName, lastName, email, phone, countryCode, password, role, dateOfBirth]
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         countryCode:
 *           type: string
 *           description: ISO 3166-1 alpha-2 (e.g. NG, US)
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: [client]
 *         dateOfBirth:
 *           type: string
 *           description: ISO date YYYY-MM-DD
 *       example:
 *         firstName: "Jane"
 *         lastName: "Doe"
 *         email: "jane@example.com"
 *         phone: "+2348000000000"
 *         countryCode: "NG"
 *         password: "SecurePass123!"
 *         role: "client"
 *         dateOfBirth: "1990-01-15"
 *
 *     RegisterRequestProvider:
 *       type: object
 *       required: [firstName, lastName, email, phone, countryCode, password, role, businessName, physicalAddress]
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         countryCode:
 *           type: string
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: [service_provider]
 *         businessName:
 *           type: string
 *         physicalAddress:
 *           type: string
 *         website:
 *           type: string
 *           nullable: true
 *       example:
 *         firstName: "Acme"
 *         lastName: "Medical"
 *         email: "provider@example.com"
 *         phone: "+2348000000001"
 *         countryCode: "NG"
 *         password: "SecurePass123!"
 *         role: "service_provider"
 *         businessName: "Acme Ambulance Services"
 *         physicalAddress: "12 Hospital Road, Lagos"
 *         website: "https://acme.example.com"
 *
 *     LoginRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *       example:
 *         email: "jane@example.com"
 *         password: "SecurePass123!"
 *
 *     ForgotPasswordRequest:
 *       type: object
 *       required: [email, newPassword]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         newPassword:
 *           type: string
 *           format: password
 *       example:
 *         email: "jane@example.com"
 *         newPassword: "NewSecurePass456!"
 *
 *     CartItemInput:
 *       type: object
 *       required: [serviceId]
 *       properties:
 *         serviceId:
 *           type: string
 *         quantity:
 *           type: number
 *           minimum: 1
 *       example:
 *         serviceId: "507f1f77bcf86cd799439012"
 *         quantity: 1
 *
 *     CartQuantityPatch:
 *       type: object
 *       required: [quantity]
 *       properties:
 *         quantity:
 *           type: number
 *           minimum: 0
 *       example:
 *         quantity: 2
 *
 *     ServiceUpsert:
 *       type: object
 *       required: [title, description, serviceCategorySlug, departmentSlug]
 *       properties:
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         serviceCategorySlug:
 *           type: string
 *         departmentSlug:
 *           type: string
 *         listingType:
 *           $ref: '#/components/schemas/ListingType'
 *         stock:
 *           type: number
 *           nullable: true
 *           minimum: 0
 *         price:
 *           type: number
 *           nullable: true
 *           minimum: 0
 *         pricingPeriod:
 *           $ref: '#/components/schemas/PricingPeriod'
 *         photoUrls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *       example:
 *         title: "BLS Ambulance Hire"
 *         description: "Basic life support ambulance available for hire."
 *         serviceCategorySlug: "ambulance-hire"
 *         departmentSlug: "road-transport"
 *         listingType: "hire"
 *         stock: 3
 *         price: 50000
 *         pricingPeriod: "daily"
 *         photoUrls:
 *           - "https://res.cloudinary.com/example/image/upload/v1/ambulance.jpg"
 *
 *     AvailabilityPatch:
 *       type: object
 *       required: [isAvailable]
 *       properties:
 *         isAvailable:
 *           type: boolean
 *       example:
 *         isAvailable: false
 *
 *     HireCheckoutRequest:
 *       type: object
 *       required: [serviceId, quantity, hireStart, hireEnd]
 *       properties:
 *         serviceId:
 *           type: string
 *         quantity:
 *           type: number
 *           minimum: 1
 *         hireStart:
 *           type: string
 *           format: date-time
 *           description: ISO 8601 start of hire window
 *         hireEnd:
 *           type: string
 *           format: date-time
 *           description: ISO 8601 end of hire window
 *       example:
 *         serviceId: "507f1f77bcf86cd799439012"
 *         quantity: 1
 *         hireStart: "2026-06-01T08:00:00.000Z"
 *         hireEnd: "2026-06-03T18:00:00.000Z"
 *
 *     ServiceCategoryCreate:
 *       type: object
 *       required: [name]
 *       properties:
 *         name:
 *           type: string
 *         departments:
 *           type: array
 *           items:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *         bannerUrl:
 *           type: string
 *           nullable: true
 *         note:
 *           type: string
 *           nullable: true
 *       example:
 *         name: "Custom Category"
 *         departments:
 *           - name: "General"
 *         thumbnailUrl: null
 *         bannerUrl: null
 *         note: "Admin-created category"
 *
 *     ServiceCategoryUpdate:
 *       type: object
 *       properties:
 *         thumbnailUrl:
 *           type: string
 *           nullable: true
 *         bannerUrl:
 *           type: string
 *           nullable: true
 *         note:
 *           type: string
 *           nullable: true
 *       example:
 *         note: "Updated category note"
 *         bannerUrl: "https://res.cloudinary.com/example/banner.jpg"
 *
 *     CountryCodeValid:
 *       type: object
 *       properties:
 *         valid:
 *           type: boolean
 *         code:
 *           type: string
 *       example:
 *         valid: true
 *         code: "NG"
 *
 *     UploadUrlsResponse:
 *       type: object
 *       properties:
 *         urls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *       example:
 *         urls:
 *           - "https://res.cloudinary.com/example/image/upload/v1/photo1.jpg"
 */
