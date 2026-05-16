/**
 * @openapi
 * components:
 *   schemas:
 *     AuthUserResponse:
 *       type: object
 *       required: [user]
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/PublicUser'
 *       example:
 *         user:
 *           id: "507f1f77bcf86cd799439011"
 *           firstName: "Jane"
 *           lastName: "Doe"
 *           email: "jane@example.com"
 *           role: "client"
 *           emailVerified: false
 *           dateOfBirth: "1990-01-15"
 *           phone: "+2348000000000"
 *           countryCode: "NG"
 *
 *     ForgotPasswordResponse:
 *       type: object
 *       required: [ok, message]
 *       properties:
 *         ok:
 *           type: boolean
 *         message:
 *           type: string
 *       example:
 *         ok: true
 *         message: "If an account exists for that email, the password has been updated. You can sign in with the new password."
 *
 *     OkMessageResponse:
 *       type: object
 *       required: [ok, message]
 *       properties:
 *         ok:
 *           type: boolean
 *         message:
 *           type: string
 *       example:
 *         ok: true
 *         message: "Password updated successfully"
 *
 *     UpdateClientProfileRequest:
 *       type: object
 *       required: [firstName, lastName, phone, countryCode, dateOfBirth]
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         phone:
 *           type: string
 *         countryCode:
 *           type: string
 *           description: ISO 3166-1 alpha-2
 *         dateOfBirth:
 *           type: string
 *           format: date
 *           example: "1990-01-15"
 *       example:
 *         firstName: "Jane"
 *         lastName: "Doe"
 *         phone: "+2348000000000"
 *         countryCode: "NG"
 *         dateOfBirth: "1990-01-15"
 *
 *     UpdateProviderProfileRequest:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - phone
 *         - countryCode
 *         - businessName
 *         - physicalAddress
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
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
 *           description: Optional business website
 *       example:
 *         firstName: "Jane"
 *         lastName: "Provider"
 *         phone: "+2348000000000"
 *         countryCode: "NG"
 *         businessName: "Acme Ambulance Ltd"
 *         physicalAddress: "12 Marina Road, Lagos"
 *         website: "https://example.com"
 *
 *     ChangePasswordRequest:
 *       type: object
 *       required: [currentPassword, newPassword]
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 8
 *       example:
 *         currentPassword: "OldSecurePass123!"
 *         newPassword: "NewSecurePass456!"
 *
 *     CountryCodeInvalid:
 *       type: object
 *       properties:
 *         valid:
 *           type: boolean
 *         message:
 *           type: string
 *       example:
 *         valid: false
 *         message: "Invalid ISO 3166-1 alpha-2 country code"
 *
 *     CountryStateOption:
 *       type: object
 *       required: [code, name]
 *       properties:
 *         code:
 *           type: string
 *         name:
 *           type: string
 *       example:
 *         code: "LA"
 *         name: "Lagos"
 *
 *     CountryStatesResponse:
 *       type: object
 *       required: [states]
 *       properties:
 *         states:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CountryStateOption'
 *       example:
 *         states:
 *           - code: "LA"
 *             name: "Lagos"
 *
 *     ServiceCategoryDepartment:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         order:
 *           type: integer
 *       example:
 *         name: "Road Transport"
 *         slug: "road-transport"
 *         order: 0
 *
 *     ServiceCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         slug:
 *           type: string
 *         departments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceCategoryDepartment'
 *         thumbnailUrl:
 *           type: string
 *         bannerUrl:
 *           type: string
 *         note:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439050"
 *         name: "Medical Transport"
 *         slug: "medical-transport"
 *         departments:
 *           - name: "Road Transport"
 *             slug: "road-transport"
 *             order: 0
 *         bannerUrl: "https://res.cloudinary.com/example/banner.jpg"
 *         createdAt: "2026-01-15T10:00:00.000Z"
 *         updatedAt: "2026-01-15T10:00:00.000Z"
 *
 *     ServiceCategoryListResponse:
 *       type: object
 *       required: [serviceCategories]
 *       properties:
 *         serviceCategories:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ServiceCategory'
 *       example:
 *         serviceCategories:
 *           - id: "507f1f77bcf86cd799439050"
 *             name: "Medical Transport"
 *             slug: "medical-transport"
 *             departments:
 *               - name: "Road Transport"
 *                 slug: "road-transport"
 *                 order: 0
 *
 *     ServiceCategoryResponse:
 *       type: object
 *       required: [serviceCategory]
 *       properties:
 *         serviceCategory:
 *           $ref: '#/components/schemas/ServiceCategory'
 *       example:
 *         serviceCategory:
 *           id: "507f1f77bcf86cd799439050"
 *           name: "Medical Transport"
 *           slug: "medical-transport"
 *           departments:
 *             - name: "Road Transport"
 *               slug: "road-transport"
 *               order: 0
 *           createdAt: "2026-01-15T10:00:00.000Z"
 *           updatedAt: "2026-01-15T10:00:00.000Z"
 *
 *     ServiceCategoryRef:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         slug:
 *           type: string
 *         name:
 *           type: string
 *       example:
 *         id: "507f1f77bcf86cd799439050"
 *         slug: "medical-transport"
 *         name: "Medical Transport"
 *
 *     Service:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         listingType:
 *           $ref: '#/components/schemas/ListingType'
 *         stock:
 *           type: number
 *           nullable: true
 *         price:
 *           type: number
 *           nullable: true
 *         pricingPeriod:
 *           $ref: '#/components/schemas/PricingPeriod'
 *         isAvailable:
 *           type: boolean
 *         departmentSlug:
 *           type: string
 *         departmentName:
 *           type: string
 *         category:
 *           $ref: '#/components/schemas/ServiceCategoryRef'
 *         photoUrls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         countryCode:
 *           type: string
 *           nullable: true
 *         stateProvince:
 *           type: string
 *           nullable: true
 *         stateProvinceName:
 *           type: string
 *           nullable: true
 *           description: Resolved subdivision name when countryCode and stateProvince are set
 *         officeAddress:
 *           type: string
 *           nullable: true
 *         hireReturnWindow:
 *           allOf:
 *             - $ref: '#/components/schemas/HireReturnWindow'
 *           nullable: true
 *         bookingWindow:
 *           allOf:
 *             - $ref: '#/components/schemas/HireReturnWindow'
 *           nullable: true
 *           description: Weekly bookable hours (WAT) for book listings
 *         bookingGapMinutes:
 *           type: integer
 *           minimum: 0
 *           nullable: true
 *           description: Minimum minutes between consecutive bookings
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439012"
 *         title: "BLS Ambulance Hire"
 *         description: "Basic life support ambulance available for hire."
 *         listingType: "hire"
 *         stock: 3
 *         price: 50000
 *         pricingPeriod: "daily"
 *         isAvailable: true
 *         departmentSlug: "road-transport"
 *         departmentName: "Road Transport"
 *         category:
 *           id: "507f1f77bcf86cd799439050"
 *           slug: "medical-transport"
 *           name: "Medical Transport"
 *         countryCode: "NG"
 *         stateProvince: "LA"
 *         stateProvinceName: "Lagos"
 *         officeAddress: "12 Admiralty Way, Lekki Phase 1, Lagos"
 *         hireReturnWindow:
 *           daysOfWeek: [1, 2, 3, 4, 5]
 *           timeStart: "09:00"
 *           timeEnd: "16:00"
 *         photoUrls:
 *           - "https://res.cloudinary.com/example/image/upload/v1/ambulance.jpg"
 *         createdAt: "2026-02-01T12:00:00.000Z"
 *         updatedAt: "2026-02-01T12:00:00.000Z"
 *
 *     ServiceResponse:
 *       type: object
 *       required: [service]
 *       properties:
 *         service:
 *           $ref: '#/components/schemas/Service'
 *       example:
 *         service:
 *           id: "507f1f77bcf86cd799439012"
 *           title: "BLS Ambulance Hire"
 *           description: "Basic life support ambulance available for hire."
 *           listingType: "hire"
 *           stock: 3
 *           price: 50000
 *           pricingPeriod: "daily"
 *           isAvailable: true
 *           departmentSlug: "road-transport"
 *           departmentName: "Road Transport"
 *           category:
 *             id: "507f1f77bcf86cd799439050"
 *             slug: "medical-transport"
 *             name: "Medical Transport"
 *           photoUrls:
 *             - "https://res.cloudinary.com/example/image/upload/v1/ambulance.jpg"
 *           createdAt: "2026-02-01T12:00:00.000Z"
 *           updatedAt: "2026-02-01T12:00:00.000Z"
 *
 *     ServiceListResponse:
 *       type: object
 *       required: [services]
 *       properties:
 *         services:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Service'
 *       example:
 *         services:
 *           - id: "507f1f77bcf86cd799439012"
 *             title: "BLS Ambulance Hire"
 *             description: "Basic life support ambulance."
 *             listingType: "hire"
 *             stock: 3
 *             price: 50000
 *             pricingPeriod: "daily"
 *             isAvailable: true
 *             departmentSlug: "road-transport"
 *             departmentName: "Road Transport"
 *             category:
 *               id: "507f1f77bcf86cd799439050"
 *               slug: "medical-transport"
 *               name: "Medical Transport"
 *             photoUrls: []
 *             createdAt: "2026-02-01T12:00:00.000Z"
 *             updatedAt: "2026-02-01T12:00:00.000Z"
 *
 *     MarketplaceListResponse:
 *       type: object
 *       required: [services, bannerUrl]
 *       properties:
 *         services:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Service'
 *         bannerUrl:
 *           type: string
 *           nullable: true
 *       example:
 *         services:
 *           - id: "507f1f77bcf86cd799439012"
 *             title: "BLS Ambulance Hire"
 *             description: "Basic life support ambulance."
 *             listingType: "hire"
 *             stock: 3
 *             price: 50000
 *             pricingPeriod: "daily"
 *             isAvailable: true
 *             departmentSlug: "road-transport"
 *             departmentName: "Road Transport"
 *             category:
 *               id: "507f1f77bcf86cd799439050"
 *               slug: "medical-transport"
 *               name: "Medical Transport"
 *             photoUrls: []
 *             createdAt: "2026-02-01T12:00:00.000Z"
 *             updatedAt: "2026-02-01T12:00:00.000Z"
 *         bannerUrl: "https://res.cloudinary.com/example/banner.jpg"
 *
 *     CartLineCategory:
 *       type: object
 *       properties:
 *         slug:
 *           type: string
 *         name:
 *           type: string
 *       example:
 *         slug: "medical-transport"
 *         name: "Medical Transport"
 *
 *     CartLine:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: string
 *         quantity:
 *           type: integer
 *         title:
 *           type: string
 *         listingType:
 *           $ref: '#/components/schemas/ListingType'
 *         stock:
 *           type: number
 *           nullable: true
 *         price:
 *           type: number
 *           nullable: true
 *         departmentSlug:
 *           type: string
 *         departmentName:
 *           type: string
 *         category:
 *           $ref: '#/components/schemas/CartLineCategory'
 *         photoUrls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *         lineTotalNgn:
 *           type: number
 *           nullable: true
 *       example:
 *         serviceId: "507f1f77bcf86cd799439012"
 *         quantity: 2
 *         title: "BLS Ambulance"
 *         listingType: "sale"
 *         stock: 10
 *         price: 50000
 *         departmentSlug: "road-transport"
 *         departmentName: "Road Transport"
 *         category:
 *           slug: "medical-transport"
 *           name: "Medical Transport"
 *         photoUrls:
 *           - "https://res.cloudinary.com/example/ambulance.jpg"
 *         lineTotalNgn: 100000
 *
 *     Cart:
 *       type: object
 *       required: [items]
 *       properties:
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartLine'
 *       example:
 *         items:
 *           - serviceId: "507f1f77bcf86cd799439012"
 *             quantity: 2
 *             title: "BLS Ambulance"
 *             listingType: "sale"
 *             stock: 10
 *             price: 50000
 *             departmentSlug: "road-transport"
 *             departmentName: "Road Transport"
 *             category:
 *               slug: "medical-transport"
 *               name: "Medical Transport"
 *             photoUrls: []
 *             lineTotalNgn: 100000
 *
 *     CartResponse:
 *       type: object
 *       required: [cart]
 *       properties:
 *         cart:
 *           $ref: '#/components/schemas/Cart'
 *
 *     OrderLine:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: string
 *         sellerUserId:
 *           type: string
 *         lineKind:
 *           type: string
 *           enum: [sale, hire]
 *         title:
 *           type: string
 *         unitPriceNgn:
 *           type: number
 *         quantity:
 *           type: integer
 *         lineTotalNgn:
 *           type: number
 *         categoryName:
 *           type: string
 *         categorySlug:
 *           type: string
 *         departmentName:
 *           type: string
 *         hireStart:
 *           type: string
 *           format: date-time
 *         hireEnd:
 *           type: string
 *           format: date-time
 *         pricingPeriod:
 *           $ref: '#/components/schemas/PricingPeriod'
 *         hireBillableUnits:
 *           type: number
 *       example:
 *         serviceId: "507f1f77bcf86cd799439012"
 *         sellerUserId: "507f1f77bcf86cd799439099"
 *         lineKind: "sale"
 *         title: "BLS Ambulance"
 *         unitPriceNgn: 50000
 *         quantity: 2
 *         lineTotalNgn: 100000
 *         categoryName: "Medical Transport"
 *         categorySlug: "medical-transport"
 *         departmentName: "Road Transport"
 *
 *     OrderSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         subtotalNgn:
 *           type: number
 *         currency:
 *           type: string
 *         paidAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lineCount:
 *           type: integer
 *       example:
 *         id: "507f1f77bcf86cd799439030"
 *         receiptNumber: "RCP-2026-00042"
 *         subtotalNgn: 100000
 *         currency: "NGN"
 *         paidAt: "2026-05-10T14:30:00.000Z"
 *         createdAt: "2026-05-10T14:30:00.000Z"
 *         lineCount: 1
 *
 *     OrderDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         currency:
 *           type: string
 *         subtotalNgn:
 *           type: number
 *         lines:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderLine'
 *         paymentProvider:
 *           type: string
 *         paystackReference:
 *           type: string
 *         paystackSimulated:
 *           type: boolean
 *         paidAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439030"
 *         receiptNumber: "RCP-2026-00042"
 *         currency: "NGN"
 *         subtotalNgn: 100000
 *         lines:
 *           - serviceId: "507f1f77bcf86cd799439012"
 *             sellerUserId: "507f1f77bcf86cd799439099"
 *             lineKind: "sale"
 *             title: "BLS Ambulance"
 *             unitPriceNgn: 50000
 *             quantity: 2
 *             lineTotalNgn: 100000
 *             categoryName: "Medical Transport"
 *             categorySlug: "medical-transport"
 *             departmentName: "Road Transport"
 *         paymentProvider: "paystack"
 *         paystackReference: "SIM-abc123"
 *         paystackSimulated: true
 *         paidAt: "2026-05-10T14:30:00.000Z"
 *         createdAt: "2026-05-10T14:30:00.000Z"
 *
 *     OrderResponse:
 *       type: object
 *       required: [order]
 *       properties:
 *         order:
 *           $ref: '#/components/schemas/OrderDetail'
 *       example:
 *         order:
 *           id: "507f1f77bcf86cd799439030"
 *           receiptNumber: "RCP-2026-00042"
 *           currency: "NGN"
 *           subtotalNgn: 100000
 *           lines:
 *             - serviceId: "507f1f77bcf86cd799439012"
 *               lineKind: "sale"
 *               title: "BLS Ambulance"
 *               unitPriceNgn: 50000
 *               quantity: 2
 *               lineTotalNgn: 100000
 *               categoryName: "Medical Transport"
 *               categorySlug: "medical-transport"
 *               departmentName: "Road Transport"
 *           paymentProvider: "paystack"
 *           paystackReference: "SIM-abc123"
 *           paystackSimulated: true
 *           paidAt: "2026-05-10T14:30:00.000Z"
 *           createdAt: "2026-05-10T14:30:00.000Z"
 *
 *     OrderListResponse:
 *       type: object
 *       required: [orders]
 *       properties:
 *         orders:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderSummary'
 *       example:
 *         orders:
 *           - id: "507f1f77bcf86cd799439030"
 *             receiptNumber: "RCP-2026-00042"
 *             subtotalNgn: 100000
 *             currency: "NGN"
 *             paidAt: "2026-05-10T14:30:00.000Z"
 *             createdAt: "2026-05-10T14:30:00.000Z"
 *             lineCount: 1
 *
 *     SimulateCheckoutResponse:
 *       type: object
 *       required: [order, message]
 *       properties:
 *         order:
 *           $ref: '#/components/schemas/OrderDetail'
 *         message:
 *           type: string
 *       example:
 *         order:
 *           id: "507f1f77bcf86cd799439030"
 *           receiptNumber: "RCP-2026-00042"
 *           currency: "NGN"
 *           subtotalNgn: 100000
 *           lines:
 *             - serviceId: "507f1f77bcf86cd799439012"
 *               lineKind: "sale"
 *               title: "BLS Ambulance"
 *               unitPriceNgn: 50000
 *               quantity: 2
 *               lineTotalNgn: 100000
 *               categoryName: "Medical Transport"
 *               categorySlug: "medical-transport"
 *               departmentName: "Road Transport"
 *           paymentProvider: "paystack"
 *           paystackReference: "SIM-abc123"
 *           paystackSimulated: true
 *           paidAt: "2026-05-10T14:30:00.000Z"
 *           createdAt: "2026-05-10T14:30:00.000Z"
 *         message: "Simulated Paystack checkout completed"
 *
 *     ReceiptLine:
 *       type: object
 *       properties:
 *         serviceId:
 *           type: string
 *         sellerUserId:
 *           type: string
 *         lineKind:
 *           type: string
 *           enum: [sale, hire]
 *         title:
 *           type: string
 *         unitPriceNgn:
 *           type: number
 *         quantity:
 *           type: integer
 *         lineTotalNgn:
 *           type: number
 *         categoryName:
 *           type: string
 *         departmentName:
 *           type: string
 *         hireStart:
 *           type: string
 *           format: date-time
 *         hireEnd:
 *           type: string
 *           format: date-time
 *         pricingPeriod:
 *           $ref: '#/components/schemas/PricingPeriod'
 *         hireBillableUnits:
 *           type: number
 *         primaryPhotoUrl:
 *           type: string
 *           description: First listing photo when the service still exists
 *       example:
 *         serviceId: "507f1f77bcf86cd799439012"
 *         lineKind: "hire"
 *         title: "BLS Ambulance Hire"
 *         unitPriceNgn: 50000
 *         quantity: 1
 *         lineTotalNgn: 150000
 *         categoryName: "Medical Transport"
 *         departmentName: "Road Transport"
 *         hireStart: "2026-06-01T08:00:00.000Z"
 *         hireEnd: "2026-06-03T18:00:00.000Z"
 *         pricingPeriod: "daily"
 *         hireBillableUnits: 3
 *
 *     ReceiptSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         orderId:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         subtotalNgn:
 *           type: number
 *         currency:
 *           type: string
 *         issuedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439031"
 *         orderId: "507f1f77bcf86cd799439030"
 *         receiptNumber: "RCP-2026-00042"
 *         subtotalNgn: 100000
 *         currency: "NGN"
 *         issuedAt: "2026-05-10T14:30:00.000Z"
 *
 *     ReceiptDetail:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         orderId:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         currency:
 *           type: string
 *         subtotalNgn:
 *           type: number
 *         lines:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReceiptLine'
 *         paymentProvider:
 *           type: string
 *         paystackReference:
 *           type: string
 *         issuedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         id: "507f1f77bcf86cd799439031"
 *         orderId: "507f1f77bcf86cd799439030"
 *         receiptNumber: "RCP-2026-00042"
 *         currency: "NGN"
 *         subtotalNgn: 100000
 *         lines:
 *           - serviceId: "507f1f77bcf86cd799439012"
 *             lineKind: "hire"
 *             title: "BLS Ambulance Hire"
 *             unitPriceNgn: 50000
 *             quantity: 1
 *             lineTotalNgn: 150000
 *             categoryName: "Medical Transport"
 *             departmentName: "Road Transport"
 *             hireStart: "2026-06-01T08:00:00.000Z"
 *             hireEnd: "2026-06-03T18:00:00.000Z"
 *             pricingPeriod: "daily"
 *             hireBillableUnits: 3
 *         paymentProvider: "paystack"
 *         paystackReference: "SIM-abc123"
 *         issuedAt: "2026-05-10T14:30:00.000Z"
 *
 *     ReceiptResponse:
 *       type: object
 *       required: [receipt]
 *       properties:
 *         receipt:
 *           $ref: '#/components/schemas/ReceiptDetail'
 *       example:
 *         receipt:
 *           id: "507f1f77bcf86cd799439031"
 *           orderId: "507f1f77bcf86cd799439030"
 *           receiptNumber: "RCP-2026-00042"
 *           currency: "NGN"
 *           subtotalNgn: 100000
 *           lines:
 *             - serviceId: "507f1f77bcf86cd799439012"
 *               lineKind: "hire"
 *               title: "BLS Ambulance Hire"
 *               unitPriceNgn: 50000
 *               quantity: 1
 *               lineTotalNgn: 150000
 *               categoryName: "Medical Transport"
 *               departmentName: "Road Transport"
 *               hireStart: "2026-06-01T08:00:00.000Z"
 *               hireEnd: "2026-06-03T18:00:00.000Z"
 *               pricingPeriod: "daily"
 *               hireBillableUnits: 3
 *           paymentProvider: "paystack"
 *           paystackReference: "SIM-abc123"
 *           issuedAt: "2026-05-10T14:30:00.000Z"
 *
 *     ReceiptListResponse:
 *       type: object
 *       required: [receipts]
 *       properties:
 *         receipts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ReceiptSummary'
 *       example:
 *         receipts:
 *           - id: "507f1f77bcf86cd799439031"
 *             orderId: "507f1f77bcf86cd799439030"
 *             receiptNumber: "RCP-2026-00042"
 *             subtotalNgn: 100000
 *             currency: "NGN"
 *             issuedAt: "2026-05-10T14:30:00.000Z"
 *
 *     ProviderSalesMonthBucket:
 *       type: object
 *       properties:
 *         yearMonth:
 *           type: string
 *           description: "YYYY-MM (UTC)"
 *         label:
 *           type: string
 *           description: Short month label
 *         totalNgn:
 *           type: number
 *       example:
 *         yearMonth: "2026-05"
 *         label: "May"
 *         totalNgn: 250000
 *
 *     ProviderSalesByMonthResponse:
 *       type: object
 *       required: [year, months]
 *       properties:
 *         year:
 *           type: integer
 *         months:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProviderSalesMonthBucket'
 *       example:
 *         year: 2026
 *         months:
 *           - yearMonth: "2026-01"
 *             label: "Jan"
 *             totalNgn: 0
 *           - yearMonth: "2026-05"
 *             label: "May"
 *             totalNgn: 250000
 *
 *     ProviderHireBookingCustomer:
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
 *         phone:
 *           type: string
 *       example:
 *         id: "507f1f77bcf86cd799439011"
 *         firstName: "Jane"
 *         lastName: "Doe"
 *         email: "jane@example.com"
 *         phone: "+2348000000000"
 *
 *     ProviderHireBookingRow:
 *       type: object
 *       properties:
 *         orderId:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         paidAt:
 *           type: string
 *           format: date-time
 *         serviceId:
 *           type: string
 *         listingTitle:
 *           type: string
 *         hireStart:
 *           type: string
 *           format: date-time
 *         hireEnd:
 *           type: string
 *           format: date-time
 *         pricingPeriod:
 *           $ref: '#/components/schemas/PricingPeriod'
 *         hireBillableUnits:
 *           type: number
 *         quantity:
 *           type: integer
 *         lineTotalNgn:
 *           type: number
 *         customer:
 *           $ref: '#/components/schemas/ProviderHireBookingCustomer'
 *       example:
 *         orderId: "507f1f77bcf86cd799439030"
 *         receiptNumber: "RCP-2026-00042"
 *         paidAt: "2026-05-10T14:30:00.000Z"
 *         serviceId: "507f1f77bcf86cd799439012"
 *         listingTitle: "BLS Ambulance Hire"
 *         hireStart: "2026-06-01T08:00:00.000Z"
 *         hireEnd: "2026-06-03T18:00:00.000Z"
 *         pricingPeriod: "daily"
 *         hireBillableUnits: 3
 *         quantity: 1
 *         lineTotalNgn: 150000
 *         customer:
 *           id: "507f1f77bcf86cd799439011"
 *           firstName: "Jane"
 *           lastName: "Doe"
 *           email: "jane@example.com"
 *           phone: "+2348000000000"
 *
 *     ProviderHireBookingsResponse:
 *       type: object
 *       required: [bookings]
 *       properties:
 *         bookings:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProviderHireBookingRow'
 *       example:
 *         bookings:
 *           - orderId: "507f1f77bcf86cd799439030"
 *             receiptNumber: "RCP-2026-00042"
 *             paidAt: "2026-05-10T14:30:00.000Z"
 *             serviceId: "507f1f77bcf86cd799439012"
 *             listingTitle: "BLS Ambulance Hire"
 *             hireStart: "2026-06-01T08:00:00.000Z"
 *             hireEnd: "2026-06-03T18:00:00.000Z"
 *             pricingPeriod: "daily"
 *             hireBillableUnits: 3
 *             quantity: 1
 *             lineTotalNgn: 150000
 *             customer:
 *               id: "507f1f77bcf86cd799439011"
 *               firstName: "Jane"
 *               lastName: "Doe"
 *               email: "jane@example.com"
 *               phone: "+2348000000000"
 *
 *     Wallet:
 *       type: object
 *       properties:
 *         balanceNgn:
 *           type: number
 *         currency:
 *           type: string
 *       example:
 *         balanceNgn: 125000
 *         currency: "NGN"
 *
 *     WalletResponse:
 *       type: object
 *       required: [wallet]
 *       properties:
 *         wallet:
 *           $ref: '#/components/schemas/Wallet'
 *       example:
 *         wallet:
 *           balanceNgn: 125000
 *           currency: "NGN"
 *
 *     Review:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         serviceId:
 *           type: string
 *         orderId:
 *           type: string
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         body:
 *           type: string
 *         serviceTitle:
 *           type: string
 *         categorySlug:
 *           type: string
 *         lineKind:
 *           type: string
 *           nullable: true
 *           enum: [sale, hire]
 *         reviewerDisplayName:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     ReviewResponse:
 *       type: object
 *       required: [review]
 *       properties:
 *         review:
 *           $ref: '#/components/schemas/Review'
 *
 *     ReviewListResponse:
 *       type: object
 *       required: [reviews]
 *       properties:
 *         reviews:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Review'
 *
 *     EligibleReview:
 *       type: object
 *       properties:
 *         orderId:
 *           type: string
 *         serviceId:
 *           type: string
 *         receiptNumber:
 *           type: string
 *         serviceTitle:
 *           type: string
 *         categorySlug:
 *           type: string
 *         lineKind:
 *           type: string
 *           nullable: true
 *         paidAt:
 *           type: string
 *           format: date-time
 *         hireEnd:
 *           type: string
 *           nullable: true
 *           format: date-time
 *
 *     EligibleReviewListResponse:
 *       type: object
 *       required: [eligible]
 *       properties:
 *         eligible:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/EligibleReview'
 *
 *     ServiceReviewSummary:
 *       type: object
 *       properties:
 *         averageRating:
 *           type: number
 *           nullable: true
 *         reviewCount:
 *           type: integer
 *
 *     ServiceReviewsResponse:
 *       type: object
 *       required: [summary, reviews]
 *       properties:
 *         summary:
 *           $ref: '#/components/schemas/ServiceReviewSummary'
 *         reviews:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Review'
 *
 *     ReviewCreateInput:
 *       type: object
 *       required: [orderId, serviceId, rating, body]
 *       properties:
 *         orderId:
 *           type: string
 *         serviceId:
 *           type: string
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *         body:
 *           type: string
 *           minLength: 10
 *           maxLength: 2000
 *
 *     Notification:
 *       type: object
 *       required:
 *         - id
 *         - type
 *         - title
 *         - body
 *         - orderId
 *         - serviceId
 *         - readAt
 *         - createdAt
 *       properties:
 *         id:
 *           type: string
 *         type:
 *           type: string
 *           enum:
 *             - hire_return_reminder
 *             - provider_sale_purchased
 *             - provider_hire_booked
 *             - provider_hire_return_reminder
 *         reminderKind:
 *           type: string
 *           enum: [1d, 1h]
 *           nullable: true
 *         title:
 *           type: string
 *         body:
 *           type: string
 *         orderId:
 *           type: string
 *         serviceId:
 *           type: string
 *         receiptNumber:
 *           type: string
 *           nullable: true
 *         deadlineAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         readAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     NotificationListResponse:
 *       type: object
 *       required: [notifications]
 *       properties:
 *         notifications:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Notification'
 *
 *     NotificationUnreadCountResponse:
 *       type: object
 *       required: [count]
 *       properties:
 *         count:
 *           type: integer
 *
 *     NotificationReadResponse:
 *       type: object
 *       required: [notification]
 *       properties:
 *         notification:
 *           $ref: '#/components/schemas/Notification'
 *
 *     NotificationMarkAllReadResponse:
 *       type: object
 *       required: [modifiedCount]
 *       properties:
 *         modifiedCount:
 *           type: integer
 */
