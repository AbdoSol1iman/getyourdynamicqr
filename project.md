```
You are working on a project called Dynamic QR SaaS.
```

```
Your job is to help me build this project professionally, step by step, while
keeping the code understandable because I am still learning backend development.
```

# `IMPORTANT:` 

- `Do NOT blindly generate the entire project at once.` 

- `Work incrementally.` 

- `Before making major architectural changes, explain what you are going to do.` 

- `Keep the implementation simple and production-oriented.` 

- `Do not introduce unnecessary libraries or complexity.` 

- `Do not replace the chosen stack.` 

- `After each major step, make sure the previous functionality still works.` 

- `Prefer clean, understandable code over clever code.` 

```
==================================================
```

# `1. PROJECT IDEA` 

```
==================================================
```

```
This is a Dynamic QR Code SaaS.
```

```
The core idea:
```

```
A printed QR code does NOT directly contain the user's final destination.
```

```
Instead, it contains a URL controlled by our backend:
```

```
https://our-domain.com/q/SHORT_CODE
```

```
Example:
```

```
https://getyourdynamicqr.com/q/aX7bK9
```

```
When somebody scans it:
```

`1. The request reaches our backend.` 

`2. Backend extracts the shortCode.` 

`3. Backend looks up the QR code in PostgreSQL.` 

`4. Backend records a scan event.` 

`5. Backend redirects the visitor to the currently configured destination URL.` 

```
Example:
```

```
QR printed today:
```

```
https://getyourdynamicqr.com/q/aX7bK9
```

```
Current destination:
```

```
https://instagram.com/business
```

```
Later the owner changes the destination to:
```

```
https://google.com/maps/...
```

```
The physical QR code does NOT need to be printed again.
```

```
That is the core functionality of the entire product.
```

```
==================================================
```

```
2. TECHNOLOGY STACK
```

```
==================================================
```

```
Backend:
```

```
- Node.js
- Express
- JavaScript
- CommonJS for now
Database:
- PostgreSQL
```

```
ORM:
- Prisma 7.x
Prisma PostgreSQL driver:
- @prisma/adapter-pg
- pg
Frontend:
- Angular
Authentication:
- bcrypt for password hashing
- JWT for API authentication
Other backend libraries:
- dotenv
- cors
- jsonwebtoken
- bcrypt
Development:
- npm
- nodemon
- Git
Do NOT switch to:
- MongoDB
- Mongoose
- TypeORM
- NestJS
- another backend framework
```

```
The project deliberately uses PostgreSQL because the data is relational:
```

```
User
  ↓
QR Codes
  ↓
Scan Events
==================================================
3. CORE ARCHITECTURE
==================================================
```

```
The system should eventually look like:
```

```
Angular Frontend
        |
        | HTTP / REST API
        v
Node.js + Express
        |
        v
Prisma
        |
        v
```

```
PostgreSQL
```

```
QR scanning flow:
```

```
User scans QR
      |
      v
GET /q/:shortCode
      |
      v
Find QRCode in PostgreSQL
      |
      +---- invalid/inactive --> 404
      |
      v
Create scan event
      |
      v
HTTP 302 redirect
      |
      v
destinationUrl
```

```
IMPORTANT:
```

```
The QR image must contain OUR redirect URL, never the user's final destination
URL.
```

```
==================================================
```

# `4. DATABASE DESIGN` 

```
==================================================
```

```
There are 3 core tables.
```

```
--------------------------------------------------
```

```
USERS
```

```
--------------------------------------------------
```

```
Purpose:
Store application users.
```

```
Fields:
```

```
id
email
passwordHash
planType
createdAt
updatedAt
```

```
Requirements:
```

- `id is primary key.` 

- `email must be unique.` 

- `password must NEVER be stored as plain text.` 

- `passwordHash stores bcrypt hash.` 

- `planType defaults to FREE.` 

- `createdAt automatically set.` 

- `updatedAt automatically updated.` 

```
Initial plan values:
```

```
FREE
PRO
ENTERPRISE
```

```
Do not build billing yet.
--------------------------------------------------
QR CODES
--------------------------------------------------
```

```
Purpose:
Store every dynamic QR code.
```

```
Fields:
```

```
id
userId
title
shortCode
destinationUrl
qrType
isActive
designConfig
createdAt
updatedAt
deletedAt
```

```
Requirements:
```

```
- id primary key.
- userId foreign key to users.
- deleting a user should cascade to their QR codes.
- title is the name shown in dashboard.
- shortCode must be unique.
- shortCode is used in every scan request.
- shortCode must be indexed.
- destinationUrl stores the current destination.
- qrType initially defaults to URL.
- isActive controls whether the QR works.
- designConfig is JSON for future customization.
- deletedAt supports soft deletion.
- createdAt and updatedAt are automatic.
```

```
Initial qrType:
URL
Future possibilities:
VCARD
PDF
etc.
```

```
Do NOT implement those extra types yet.
```

```
--------------------------------------------------
SCAN EVENTS
--------------------------------------------------
Purpose:
Store every scan separately instead of only maintaining a counter.
```

```
Fields:
```

```
id
qrCodeId
ipAddress
countryCode
city
```

```
deviceType
os
browser
userAgent
scannedAt
```

```
Requirements:
```

- `id primary key.` 

- `qrCodeId foreign key to QRCode.` 

- `deleting QRCode should cascade delete scan events.` 

- `scannedAt defaults to current timestamp.` 

- `index on:` 

- `(qrCodeId, scannedAt DESC)` 

```
Why a separate scan_events table?
```

```
Because later we want analytics such as:
```

- `total scans` 

- `scans over time` 

- `scans today` 

- `scans this week` 

- `device breakdown` 

- `OS breakdown` 

- `browser breakdown` 

- `country breakdown` 

- `city breakdown` 

```
Do NOT reduce this to a simple scan counter.
```

```
==================================================
```

# `5. PRISMA` 

```
==================================================
```

```
Use Prisma 7.
```

```
The project uses the modern Prisma PostgreSQL adapter.
```

```
Expected setup:
```

```
@prisma/client
@prisma/adapter-pg
pg
prisma
```

```
The Prisma client must use:
```

```
PrismaPg adapter
```

```
with:
```

```
process.env.DATABASE_URL
```

```
Do not instantiate PrismaClient without the PostgreSQL adapter.
```

```
Example architecture:
```

```
dotenv
```

```
  ↓
DATABASE_URL
  ↓
PrismaPg
  ↓
```

```
PrismaClient
```

```
Keep Prisma configuration clean.
```

```
==================================================
6. ENVIRONMENT VARIABLES
```

```
==================================================
```

```
Use .env.
```

```
Example:
```

```
DATABASE_URL="postgresql://dynamicqr_user:PASSWORD@localhost:5432/dynamic_qr"
PORT=3000
JWT_SECRET="some-secret"
```

```
If password contains @, it must be URL encoded inside DATABASE_URL.
```

```
Example:
@
becomes:
%40
```

```
NEVER commit .env to Git.
```

```
Create .env.example without real secrets.
```

```
Example:
```

```
DATABASE_URL=
PORT=3000
JWT_SECRET=
==================================================
7. BACKEND STRUCTURE
```

```
==================================================
```

```
Aim for a clean structure similar to:
```

```
backend/
│
├── src/
│   ├── app.js
│   ├── prisma.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── qr.routes.js
│   │   └── analytics.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── qr.controller.js
│   │   └── analytics.controller.js
│   │
│   ├── middleware/
│   │   └── auth.middleware.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── qr.service.js
│   │   └── analytics.service.js
```

```
│   │
│   └── utils/
│       ├── jwt.js
│       └── shortCode.js
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── generated/
│   └── prisma/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
└── prisma.config.ts
```

```
This structure can be adjusted if there is a strong reason.
Do not create 50 files for trivial functionality.
```

```
==================================================
8. FIRST BACKEND ENDPOINT
==================================================
```

```
Create:
GET /
```

```
Response:
```

```
{
  "message": "Dynamic QR API is running"
}
==================================================
9. HEALTH ENDPOINT
==================================================
Create:
GET /health
```

```
It should verify that Prisma can communicate with PostgreSQL.
Expected response:
{
  "status": "ok",
  "database": "connected"
}
If database connection fails:
HTTP 500
{
  "status": "error",
  "database": "disconnected"
}
==================================================
10. AUTHENTICATION
```

```
==================================================
```

```
Authentication is API-based.
```

```
Use JWT.
Flow:
```

```
REGISTER:
```

```
POST /api/auth/register
```

```
Request:
{
  "email": "user@example.com",
  "password": "password123"
}
Steps:
```

`1. Validate email.` 

`2. Validate password.` 

```
3. Check if email already exists.
```

```
4. Hash password with bcrypt.
```

`5. Create User with Prisma.` 

`6. Never return passwordHash.` 

`7. Return created user information.` 

```
Do not expose passwordHash in API responses.
```

```
LOGIN:
```

```
POST /api/auth/login
```

```
Request:
```

```
{
  "email": "user@example.com",
  "password": "password123"
}
Steps:
```

`1. Find user by email.` 

`2. Compare password using bcrypt.` 

`3. If invalid, return appropriate authentication error.` 

`4. Generate JWT.` 

`5. Return token and basic user information.` 

```
JWT payload should contain only minimal non-sensitive information.
```

```
For example:
```

```
{
  "userId": "..."
}
```

```
Do NOT put:
- password
- passwordHash
```

- `sensitive personal information` 

```
JWT is signed, not encrypted.
```

```
==================================================
11. AUTH MIDDLEWARE
==================================================
```

```
Protected routes require:
```

```
Authorization: Bearer TOKEN
```

```
Middleware should:
```

`1. Read Authorization header.` 

`2. Extract Bearer token.` 

`3. Verify JWT.` 

`4. Extract userId.` 

`5. Attach authenticated user information to request.` 

`6. Reject invalid/missing tokens.` 

```
Do not use server-side sessions for the initial MVP.
```

```
==================================================
12. QR CODE CREATION
```

```
==================================================
```

```
Main endpoint:
```

```
POST /api/qr
```

```
Protected.
```

```
Only authenticated users can create QR codes.
```

```
Request example:
```

```
{
  "title": "My Restaurant",
  "destinationUrl": "https://example.com"
}
```

```
Steps:
```

`1. Authenticate user.` 

`2. Validate destinationUrl.` 

`3. Generate unique shortCode.` 

`4. Save QRCode in PostgreSQL.` 

`5. Construct redirect URL:` 

```
https://YOUR_DOMAIN/q/SHORT_CODE
```

```
For local development:
```

```
http://localhost:3000/q/SHORT_CODE
```

`6. Generate QR image encoding that redirect URL.` 

`7. Return QR information.` 

```
IMPORTANT:
```

```
The QR image MUST encode:
```

```
http://localhost:3000/q/aX7bK9
```

```
NOT:
```

```
https://example.com
```

```
The destination can change later without regenerating the QR.
```

```
Choose a reliable QR generation package when implementing this feature.
```

```
==================================================
```

# `13. SHORT CODE` 

```
==================================================
```

```
shortCode must be:
```

- `unique` 

- `reasonably short` 

- `URL safe` 

- `unpredictable enough to avoid trivial enumeration` 

```
Example:
```

```
aX7bK9
```

```
Before inserting:
```

- `generate code` 

- `check uniqueness` 

- `retry if collision occurs` 

```
Do not use the database ID directly as the short code.
```

```
==================================================
14. MOST IMPORTANT ENDPOINT
```

```
==================================================
```

```
GET /q/:shortCode
```

```
This is the core of the entire SaaS.
```

```
Flow:
```

```
GET /q/aX7bK9
```

`1. Extract shortCode.` 

`2. Find QRCode.` 

`3. Ignore soft-deleted QR codes.` 

`4. Check isActive.` 

`5. If not found: return 404.` 

`6. If inactive: return appropriate response.` 

`7. Record scan event.` 

`8. Redirect to destinationUrl.` 

```
CRITICAL:
```

```
Use:
```

```
HTTP 302
```

```
NOT:
```

```
HTTP 301
```

```
Why?
```

```
301 is permanent and can be cached.
```

```
If browsers/cache remember the permanent redirect:
```

- `destination updates can appear broken` 

- `scan events may not be recorded on every visit` 

```
302 ensures the request reaches our server again.
```

```
==================================================
15. SCAN LOGGING
```

```
==================================================
```

```
When:
```

```
GET /q/:shortCode
```

```
is called:
```

```
Create a ScanEvent.
```

```
Capture when possible:
```

- `IP address` 

- `User-Agent` 

- `timestamp` 

```
Initially:
```

```
deviceType
```

```
os
browser
countryCode
city
```

```
can be nullable.
```

```
Do not block the redirect unnecessarily waiting for analytics enrichment.
```

```
Important:
```

```
The user should be redirected quickly.
```

```
The analytics write should be handled efficiently.
```

```
If scan logging fails, do NOT necessarily prevent the user from reaching the
destination.
```

```
The primary operation is:
```

```
redirect.
```

```
Analytics is secondary.
```

```
==================================================
16. QR MANAGEMENT
```

```
==================================================
```

```
Authenticated user should be able to:
```

```
GET /api/qr
```

```
List their QR codes.
```

```
GET /api/qr/:id
```

```
Get one QR code.
```

```
PATCH /api/qr/:id
```

```
Update:
```

- `title` 

- `destinationUrl` 

- `isActive` 

- `designConfig` 

```
IMPORTANT:
```

```
Changing destinationUrl must NOT change shortCode.
```

```
The QR image should remain valid.
```

```
DELETE /api/qr/:id
```

```
Use soft delete where appropriate by setting:
```

```
deletedAt
```

```
Do not physically delete immediately unless there is a clear reason.
Users must only access their own QR codes.
```

```
Never allow User A to modify User B's QR.
```

```
==================================================
17. ANALYTICS
```

```
==================================================
```

```
Basic MVP analytics:
```

```
GET /api/qr/:id/analytics
```

```
Return things such as:
```

```
- total scans
- scans today
- scans this week
```

```
- recent scans
```

```
Later:
```

```
- scans by date
- country
- city
- device
- OS
- browser
```

```
Use ScanEvent table.
```

```
Do not maintain only a scan counter.
```

```
==================================================
18. ANGULAR FRONTEND
==================================================
```

```
After backend authentication and QR functionality are tested with Postman/curl,
```

```
build Angular frontend.
```

```
Do NOT start Angular before backend fundamentals work.
```

```
Frontend pages:
```

`1. Login` 

`2. Register` 

`3. Dashboard` 

`4. QR details` 

`5. QR creation` 

`6. QR editing` 

`7. Analytics` 

```
Dashboard should show:
```

```
- user's QR codes
- title
- destination
- active/inactive state
```

```
- total scans
- creation date
```

```
Actions:
```

```
- Create QR
- Edit destination
```

```
- Enable/disable
```

- `Delete - View analytics` 

```
==================================================
```

# `19. IMPORTANT FRONTEND BEHAVIOR` 

```
==================================================
```

```
When user edits:
```

```
destinationUrl
```

```
the frontend must NOT generate a new QR.
```

```
The shortCode stays the same.
```

```
Only destinationUrl changes.
Example:
Before:
/q/aX7bK9 → instagram.com
After:
/q/aX7bK9 → google.com/maps
Same physical QR.
```

```
==================================================
20. CORS
==================================================
```

```
Backend and Angular frontend will eventually run on different origins.
Configure CORS correctly.
```

```
Development example:
```

```
Angular:
http://localhost:4200
```

```
Backend:
http://localhost:3000
```

```
Production origins must come from environment configuration.
```

```
Do not use unrestricted CORS in production.
```

```
==================================================
21. SECURITY
==================================================
```

```
Must have:
```

```
- bcrypt password hashing
- JWT authentication
- environment variables for secrets
- .env ignored by Git
- input validation
- authorization checks
- users can only access their own QR codes
- no passwordHash in responses
- no sensitive JWT payload
- URL validation
- appropriate HTTP status codes
```

```
Later add:
```

```
- rate limiting
- abuse protection
- URL safety validation
- brute-force login protection
- security headers
```

```
Do NOT over-engineer security in the first MVP.
```

```
==================================================
22. ERROR HANDLING
```

```
==================================================
```

```
Use consistent API responses.
```

```
Example success:
```

```
{
  "success": true,
  "data": {...}
}
Example error:
```

```
{
  "success": false,
  "message": "Invalid credentials"
}
```

```
Use appropriate HTTP status codes:
```

```
200 success
```

```
201 created
400 bad request
401 unauthenticated
403 unauthorized
404 not found
409 conflict
500 server error
```

```
Do not expose raw database errors to users.
```

```
Log useful errors on the backend.
```

```
==================================================
23. VALIDATION
==================================================
```

```
Validate:
```

```
- email format
- password length
- title length
- destination URL
- shortCode format where relevant
- IDs
```

```
Use a validation library only if it actually simplifies the code.
```

```
Do not add dependencies unnecessarily.
```

```
==================================================
24. DEPLOYMENT
```

```
==================================================
```

```
Eventually deploy separately:
```

```
Frontend:
Angular hosting
Backend:
Node.js/Express hosting
Database:
Hosted PostgreSQL
```

```
Possible services can be selected later.
```

```
Deployment requirements:
```

```
- environment variables
```

```
- production DATABASE_URL
- production JWT_SECRET
- production frontend URL
- production CORS
- HTTPS
- migrations
```

```
Do not commit:
```

```
.env
```

```
==================================================
25. DATABASE MIGRATIONS
```

```
==================================================
```

```
Use Prisma migrations.
```

```
Development:
```

```
npx prisma migrate dev
```

```
Production:
```

```
npx prisma migrate deploy
```

```
Do not manually recreate database tables in production.
```

```
Do not delete production data accidentally.
```

```
==================================================
26. GIT
```

```
==================================================
```

```
Use Git from the beginning.
```

```
Initial repository:
git init
```

```
.gitignore must include:
node_modules/
.env
generated/
*.log
```

```
Do not commit secrets.
```

```
Commit logically:
```

```
- project setup
- database schema
- auth
- QR creation
- redirect engine
- scan analytics
- frontend
- deployment
```

```
==================================================
27. MVP SCOPE
```

```
==================================================
```

```
MVP includes:
```

```
- registration
- login
- JWT authentication
- PostgreSQL
- Prisma
- create QR
- unique shortCode
- QR image generation
- dynamic redirect
- 302 redirect
- destination updates
- enable/disable QR
- soft delete
- scan event logging
```

```
- basic scan count
- Angular dashboard
- deployment
==================================================
28. NOT MVP
==================================================
```

```
Do NOT implement these initially:
```

```
- Stripe
- subscriptions
- billing
- custom domains
- advanced analytics
- geo-IP enrichment
- team accounts
- roles/permissions
- API keys
- webhooks
- white labeling
- multiple QR types
- PDF QR
- vCard QR
- enterprise features
```

```
These can be added later.
```

```
==================================================
29. RECOMMENDED IMPLEMENTATION ORDER
```

```
==================================================
```

```
Follow this exact order:
```

```
PHASE 1:
Project setup
- Node
- Express
- dotenv
- Prisma
- PostgreSQL
- Git
PHASE 2:
Database
- Prisma schema
- migration
- Prisma client
- test connection
PHASE 3:
Basic Express
- GET /
- GET /health
PHASE 4:
Authentication
- register
- bcrypt
- login
- JWT
- auth middleware
```

```
PHASE 5:
```

```
QR creation
```

```
- shortCode generation
```

```
- QRCode database record
```

```
- QR image generation
```

```
PHASE 6:
Redirect engine
- GET /q/:shortCode
- database lookup
```

```
- active/deleted checks
```

```
- scan logging
- HTTP 302 redirect
```

```
PHASE 7:
QR management
- list
- details
- update destination
- enable/disable
- soft delete
```

```
PHASE 8:
Analytics
- scan count
- basic analytics
```

```
PHASE 9:
Angular
- register
- login
- auth state
- dashboard
- QR management
- analytics
```

```
PHASE 10:
Production
- backend deployment
- PostgreSQL hosting
- Angular deployment
- CORS
- environment variables
- migrations
```

```
PHASE 11:
Future premium features
- Stripe
```

```
- plans
```

```
- custom domains
```

```
- advanced analytics
```

- `rate limiting` 

- `abuse protection` 

```
==================================================
```

# `30. DEVELOPMENT RULES` 

```
==================================================
```

```
When implementing:
```

`1. Explain the purpose of each important file.` 

`2. Explain unfamiliar concepts briefly.` 

`3. Don't hide important logic behind unnecessary abstractions.` 

`4. Keep functions small.` 

`5. Use meaningful variable names.` 

`6. Don't duplicate database logic unnecessarily.` 

`7. Don't use raw SQL unless Prisma cannot reasonably handle the operation.` 

`8. Handle async errors.` 

`9. Validate input.` 

`10. Keep authorization checks close to resource access.` 

`11. Test every backend feature before starting the frontend.` 

`12. Prefer curl/Postman for backend testing.` 

`13. Do not continue to the next phase if the current phase is broken.` 

`14. Do not silently modify architecture.` 

`15. Do not install packages unless necessary.` 

`16. Do not use sudo for npm commands.` 

`17. Never expose secrets.` 

`18. Never commit .env.` 

```
==================================================
```

# `31. CURRENT STARTING STATE` 

```
==================================================
```

```
I am restarting the project on a clean drive.
```

```
Start from the project setup.
```

```
My environment is approximately:
```

```
Node.js 22.x
npm 11.x
Git 2.x
PostgreSQL 17.x
Debian Linux
```

```
The PostgreSQL database should be:
```

```
Database:
dynamic_qr
Database user:
dynamicqr_user
```

```
The password is stored locally and must NEVER be hardcoded into source code.
```

```
The application should use DATABASE_URL.
```

```
==================================================
32. MOST IMPORTANT PRODUCT PRINCIPLE
==================================================
```

```
Never forget:
```

```
The physical QR code points to OUR server.
```

```
Example:
```

```
QR
 ↓
https://our-domain.com/q/aX7bK9
 ↓
Backend
```

```
 ↓
Database lookup
 ↓
destinationUrl
 ↓
HTTP 302 redirect
```

```
Therefore:
```

```
Changing destinationUrl does NOT require regenerating the QR.
```

```
This is the core business value of Dynamic QR SaaS.
```

```
==================================================
33. HOW YOU SHOULD WORK WITH ME
```

```
==================================================
```

```
I am learning while building.
```

```
Do not assume I understand advanced concepts.
```

```
When introducing something like:
```

```
JWT
Prisma adapter
middleware
foreign keys
indexes
transactions
async operations
```

```
briefly explain what it is and why we need it.
```

```
However, don't give extremely long theoretical explanations unless I ask.
```

```
When giving commands:
```

- `give them in exact order` 

- `tell me which directory I should be in` 

- `don't give 20 unrelated commands at once` 

- `wait for the result of important commands before continuing` 

```
If something fails:
```

`1. Explain what the error means.` 

`2. Identify the likely cause.` 

`3. Give the smallest safe fix.` 

`4. Re-test.` 

`5. Continue only after it works.` 

```
Do NOT randomly rewrite working parts of the project.
```

```
==================================================
34. FIRST TASK
```

```
==================================================
```

```
Start with PHASE 1 only.
```

```
Do NOT build authentication yet.
```

```
Do NOT build QR generation yet.
```

```
Do NOT build Angular yet.
```

```
First:
```

`1. Create backend project.` 

`2. Create package.json.` 

`3. Install required dependencies.` 

`4. Initialize Prisma.` 

`5. Configure .env.` 

`6. Configure Prisma PostgreSQL.` 

`7. Create the Prisma schema.` 

`8. Run formatting and validation.` 

`9. Create migration.` 

`10. Generate Prisma Client.` 

`11. Create Prisma connection.` 

`12. Create Express app.` 

`13. Add GET /.` 

`14. Add GET /health.` 

`15. Verify that Express can connect to PostgreSQL.` 

```
After PHASE 1 is working, stop and report:
```

- `what was created` 

- `how the pieces connect` 

- `commands used` 

- `how to test it` 

```
Then wait for me before implementing Phase 2/Authentication.
```

```
The goal is to build a real, maintainable Dynamic QR SaaS, not just a demo.
```

