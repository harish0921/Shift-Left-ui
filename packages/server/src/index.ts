import { ExpressAdapter } from '@bull-board/express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { Request, Response } from 'express'
import 'global-agent/bootstrap'
import http from 'http'
import { DataSource } from 'typeorm'
import { AbortControllerPool } from './AbortControllerPool'
import { CachePool } from './CachePool'
import { ChatFlow } from './database/entities/ChatFlow'
import { getDataSource } from './DataSource'
import { Organization } from './enterprise/database/entities/organization.entity'
import { Workspace } from './enterprise/database/entities/workspace.entity'
import { User, UserStatus } from './enterprise/database/entities/user.entity'
import { LoggedInUser } from './enterprise/Interface.Enterprise'
import { initializeJwtCookieMiddleware, verifyToken, verifyTokenForBullMQDashboard } from './enterprise/middleware/passport'
import { initAuthSecrets } from './enterprise/utils/authSecrets'
import { IdentityManager } from './IdentityManager'
import { MODE, Platform } from './Interface'
import { IMetricsProvider } from './Interface.Metrics'
import { OpenTelemetry } from './metrics/OpenTelemetry'
import { Prometheus } from './metrics/Prometheus'
import errorHandlerMiddleware from './middlewares/errors'
import { NodesPool } from './NodesPool'
import { QueueManager } from './queue/QueueManager'
import { RedisEventSubscriber } from './queue/RedisEventSubscriber'
import shiftliftApiV1Router from './routes'
import { UsageCacheManager } from './UsageCacheManager'
import { getEncryptionKey } from './utils'
import { API_KEY_BLACKLIST_URLS, WHITELIST_URLS } from './utils/constants'
import logger, { expressRequestLogger } from './utils/logger'
import { RateLimiterManager } from './utils/rateLimit'
import { SSEStreamer } from './utils/SSEStreamer'
import { Telemetry } from './utils/telemetry'
import { validateAPIKey } from './utils/validateKey'
import { getAllowedIframeOrigins, sanitizeMiddleware } from './utils/XSS'
import { v4 as uuidv4 } from 'uuid'

declare global {
    namespace Express {
        interface User extends LoggedInUser {}
        interface Request {
            user?: LoggedInUser
        }
        namespace Multer {
            interface File {
                bucket: string
                key: string
                acl: string
                contentType: string
                contentDisposition: null
                storageClass: string
                serverSideEncryption: null
                metadata: any
                location: string
                etag: string
            }
        }
    }
}

export class App {
    app: express.Application
    nodesPool: NodesPool
    abortControllerPool: AbortControllerPool
    cachePool: CachePool
    telemetry: Telemetry
    rateLimiterManager: RateLimiterManager
    AppDataSource: DataSource = getDataSource()
    sseStreamer: SSEStreamer
    identityManager: IdentityManager
    metricsProvider: IMetricsProvider
    queueManager: QueueManager
    redisSubscriber: RedisEventSubscriber
    usageCacheManager: UsageCacheManager
    sessionStore: any

    constructor() {
        this.app = express()
    }

    async initDatabase() {
        // Initialize database
        try {
            await this.AppDataSource.initialize()
            logger.info('📦 [server]: Data Source initialized successfully')

            // Run Migrations Scripts
            await this.AppDataSource.runMigrations({ transaction: 'each' })
            logger.info('🔄 [server]: Database migrations completed successfully')

            // Initialize Identity Manager
            this.identityManager = await IdentityManager.getInstance()
            logger.info('🔐 [server]: Identity Manager initialized successfully')

            // Initialize nodes pool
            this.nodesPool = new NodesPool()
            await this.nodesPool.initialize()
            logger.info('🔧 [server]: Nodes pool initialized successfully')

            // Initialize abort controllers pool
            this.abortControllerPool = new AbortControllerPool()
            logger.info('⏹️ [server]: Abort controllers pool initialized successfully')

            // Initialize encryption key
            await getEncryptionKey()
            logger.info('🔑 [server]: Encryption key initialized successfully')

            // Initialize auth secrets (env → AWS Secrets Manager → filesystem)
            await initAuthSecrets()
            logger.info('🔐 [server]: Auth initialized successfully')

            // Initialize Rate Limit
            this.rateLimiterManager = RateLimiterManager.getInstance()
            await this.rateLimiterManager.initializeRateLimiters(await getDataSource().getRepository(ChatFlow).find())
            logger.info('🚦 [server]: Rate limiters initialized successfully')

            // Initialize cache pool
            this.cachePool = new CachePool()
            logger.info('💾 [server]: Cache pool initialized successfully')

            // Initialize usage cache manager
            this.usageCacheManager = await UsageCacheManager.getInstance()
            logger.info('📊 [server]: Usage cache manager initialized successfully')

            // Initialize telemetry
            this.telemetry = new Telemetry()
            logger.info('📈 [server]: Telemetry initialized successfully')

            // Initialize SSE Streamer
            this.sseStreamer = new SSEStreamer()
            logger.info('🌊 [server]: SSE Streamer initialized successfully')

            // Init Queues
            if (process.env.MODE === MODE.QUEUE) {
                this.queueManager = QueueManager.getInstance()
                const serverAdapter = new ExpressAdapter()
                serverAdapter.setBasePath('/admin/queues')
                this.queueManager.setupAllQueues({
                    componentNodes: this.nodesPool.componentNodes,
                    telemetry: this.telemetry,
                    cachePool: this.cachePool,
                    appDataSource: this.AppDataSource,
                    abortControllerPool: this.abortControllerPool,
                    usageCacheManager: this.usageCacheManager,
                    serverAdapter
                })
                logger.info('✅ [Queue]: All queues setup successfully')

                this.redisSubscriber = new RedisEventSubscriber(this.sseStreamer)
                await this.redisSubscriber.connect()
                logger.info('🔗 [server]: Redis event subscriber connected successfully')
            }

            logger.info('🎉 [server]: All initialization steps completed successfully!')
        } catch (error) {
            logger.error('❌ [server]: Error during Data Source initialization:', error)
        }
    }

    async config() {
        // Limit is needed to allow sending/receiving base64 encoded string
        const shiftliftFileSizeLimit = process.env.SHIFTLIFT_FILE_SIZE_LIMIT || '50mb'
        this.app.use(express.json({ limit: shiftliftFileSizeLimit }))
        this.app.use(express.urlencoded({ limit: shiftliftFileSizeLimit, extended: true }))

        // Enhanced trust proxy settings for load balancer
        let trustProxy: string | boolean | number | undefined = process.env.TRUST_PROXY
        if (typeof trustProxy === 'undefined' || trustProxy.trim() === '' || trustProxy === 'true') {
            // Default to trust all proxies
            trustProxy = true
        } else if (trustProxy === 'false') {
            // Disable trust proxy
            trustProxy = false
        } else if (!isNaN(Number(trustProxy))) {
            // Number: Trust specific number of proxies
            trustProxy = Number(trustProxy)
        }

        this.app.set('trust proxy', trustProxy)

        // Allow access from specified domains
        const allowedOrigins = ['http://localhost:8080', 'http://localhost:3000', process.env.CORS_ORIGIN || '*']
        this.app.use(
            cors({
                credentials: true,
                origin: (origin, callback) => {
                    if (!origin) return callback(null, true)
                    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true)
                    return callback(null, false)
                }
            })
        )

        // Parse cookies
        this.app.use(cookieParser())

        // Allow embedding from specified domains.
        this.app.use((req, res, next) => {
            const allowedOrigins = getAllowedIframeOrigins()
            if (allowedOrigins == '*') {
                next()
            } else {
                const csp = `frame-ancestors ${allowedOrigins}`
                res.setHeader('Content-Security-Policy', csp)
                next()
            }
        })

        // Switch off the default 'X-Powered-By: Express' header
        this.app.disable('x-powered-by')

        // Add the expressRequestLogger middleware to log all requests
        this.app.use(expressRequestLogger)

        // Add the sanitizeMiddleware to guard against XSS
        this.app.use(sanitizeMiddleware)

        const denylistURLs = process.env.DENYLIST_URLS ? process.env.DENYLIST_URLS.split(',') : []
        const whitelistURLs = WHITELIST_URLS.filter((url) => !denylistURLs.includes(url))
        const URL_CASE_INSENSITIVE_REGEX: RegExp = /\/api\/v1\//i
        const URL_CASE_SENSITIVE_REGEX: RegExp = /\/api\/v1\//

        await initializeJwtCookieMiddleware(this.app, this.identityManager)

        this.app.use(async (req, res, next) => {
            // Local/dev auth bypass. Keep disabled in production.
            if (process.env.DISABLE_AUTH === 'true') {
                if (!req.user) {
                    req.user = {
                        id: 'local-dev-user',
                        name: 'Local Dev',
                        email: 'local@localhost',
                        permissions: [],
                        features: {},
                        activeOrganizationId: '',
                        activeOrganizationSubscriptionId: '',
                        activeOrganizationCustomerId: '',
                        activeOrganizationProductId: '',
                        isOrganizationAdmin: true,
                        activeWorkspaceId: '',
                        activeWorkspace: ''
                    }

                    let workspace = await this.AppDataSource.getRepository(Workspace)
                        .createQueryBuilder('workspace')
                        .orderBy('workspace.createdDate', 'ASC')
                        .getOne()

                    // Auto-bootstrap local dev workspace when database is empty.
                    if (!workspace) {
                        let localUser = await this.AppDataSource.getRepository(User)
                            .createQueryBuilder('user')
                            .orderBy('user.createdDate', 'ASC')
                            .getOne()
                        if (!localUser) {
                            const localUserId = uuidv4()
                            localUser = this.AppDataSource.getRepository(User).create({
                                id: localUserId,
                                name: 'Local Dev',
                                email: 'local@localhost',
                                status: UserStatus.ACTIVE,
                                createdBy: localUserId,
                                updatedBy: localUserId
                            })
                            localUser = await this.AppDataSource.getRepository(User).save(localUser)
                        }

                        let localOrg = await this.AppDataSource.getRepository(Organization)
                            .createQueryBuilder('organization')
                            .orderBy('organization.createdDate', 'ASC')
                            .getOne()
                        if (!localOrg) {
                            localOrg = this.AppDataSource.getRepository(Organization).create({
                                name: 'Default Organization',
                                createdBy: localUser.id,
                                updatedBy: localUser.id
                            })
                            localOrg = await this.AppDataSource.getRepository(Organization).save(localOrg)
                        }

                        workspace = this.AppDataSource.getRepository(Workspace).create({
                            name: 'Default Workspace',
                            organizationId: localOrg.id,
                            createdBy: localUser.id,
                            updatedBy: localUser.id
                        })
                        workspace = await this.AppDataSource.getRepository(Workspace).save(workspace)
                    }

                    if (workspace) {
                        const org = await this.AppDataSource.getRepository(Organization).findOne({
                            where: { id: workspace.organizationId as string }
                        })

                        // Build a minimal synthetic user context for local no-auth mode.
                        req.user = {
                            id: 'local-dev-user',
                            name: 'Local Dev',
                            email: 'local@localhost',
                            permissions: [],
                            features: {},
                            activeOrganizationId: (workspace.organizationId as string) || '',
                            activeOrganizationSubscriptionId: (org?.subscriptionId as string) || '',
                            activeOrganizationCustomerId: (org?.customerId as string) || '',
                            activeOrganizationProductId: '',
                            isOrganizationAdmin: true,
                            activeWorkspaceId: workspace.id,
                            activeWorkspace: workspace.name
                        }
                    }
                }
                return next()
            }

            // Step 1: Check if the req path contains /api/v1 regardless of case
            if (URL_CASE_INSENSITIVE_REGEX.test(req.path)) {
                // Step 2: Check if the req path is casesensitive
                if (URL_CASE_SENSITIVE_REGEX.test(req.path)) {
                    // Step 3: Check if the req path is in the whitelist
                    const isWhitelisted = whitelistURLs.some((url) => req.path.startsWith(url))
                    if (isWhitelisted) {
                        next()
                    } else if (req.headers['x-request-from'] === 'internal') {
                        verifyToken(req, res, next)
                    } else {
                        const isAPIKeyBlacklistedURLS = API_KEY_BLACKLIST_URLS.some((url) => req.path.startsWith(url))
                        if (isAPIKeyBlacklistedURLS) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        // Only check license validity for non-open-source platforms
                        if (this.identityManager.getPlatformType() !== Platform.OPEN_SOURCE) {
                            if (!this.identityManager.isLicenseValid()) {
                                return res.status(401).json({ error: 'Unauthorized Access' })
                            }
                        }

                        const { isValid, apiKey } = await validateAPIKey(req)
                        if (!isValid || !apiKey) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        // Find workspace
                        const workspace = await this.AppDataSource.getRepository(Workspace).findOne({
                            where: { id: apiKey.workspaceId }
                        })
                        if (!workspace) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }

                        // Find organization
                        const activeOrganizationId = workspace.organizationId as string
                        const org = await this.AppDataSource.getRepository(Organization).findOne({
                            where: { id: activeOrganizationId }
                        })
                        if (!org) {
                            return res.status(401).json({ error: 'Unauthorized Access' })
                        }
                        const subscriptionId = org.subscriptionId as string
                        const customerId = org.customerId as string
                        const features = await this.identityManager.getFeaturesByPlan(subscriptionId)
                        const productId = await this.identityManager.getProductIdFromSubscription(subscriptionId)
                        // @ts-ignore
                        req.user = {
                            permissions: apiKey.permissions,
                            features,
                            activeOrganizationId: activeOrganizationId,
                            activeOrganizationSubscriptionId: subscriptionId,
                            activeOrganizationCustomerId: customerId,
                            activeOrganizationProductId: productId,
                            isOrganizationAdmin: false,
                            activeWorkspaceId: workspace.id,
                            activeWorkspace: workspace.name
                        }
                        next()
                    }
                } else {
                    return res.status(401).json({ error: 'Unauthorized Access' })
                }
            } else {
                // If the req path does not contain /api/v1, then allow the request to pass through, example: /assets, /canvas
                next()
            }
        })

        // this is for SSO and must be after the JWT cookie middleware
        await this.identityManager.initializeSSO(this.app)

        if (process.env.ENABLE_METRICS === 'true') {
            switch (process.env.METRICS_PROVIDER) {
                // default to prometheus
                case 'prometheus':
                case undefined:
                    this.metricsProvider = new Prometheus(this.app)
                    break
                case 'open_telemetry':
                    this.metricsProvider = new OpenTelemetry(this.app)
                    break
                // add more cases for other metrics providers here
            }
            if (this.metricsProvider) {
                await this.metricsProvider.initializeCounters()
                logger.info(`📊 [server]: Metrics Provider [${this.metricsProvider.getName()}] has been initialized!`)
            } else {
                logger.error(
                    "❌ [server]: Metrics collection is enabled, but failed to initialize provider (valid values are 'prometheus' or 'open_telemetry'."
                )
            }
        }

        this.app.use('/api/v1', shiftliftApiV1Router)

        // ----------------------------------------
        // Configure number of proxies in Host Environment
        // ----------------------------------------
        this.app.get('/api/v1/ip', (request, response) => {
            response.send({
                ip: request.ip,
                msg: 'Check returned IP address in the response. If it matches your current IP address ( which you can get by going to http://ip.nfriedly.com/ or https://api.ipify.org/ ), then the number of proxies is correct and the rate limiter should now work correctly. If not, increase the number of proxies by 1 and restart shift left  Cloud Hosting until the IP address matches your own. Visit https://docs.shiftleftai.ai/configuration/rate-limit#cloud-hosted-rate-limit-setup-guide for more information.'
            })
        })

        if (process.env.MODE === MODE.QUEUE && process.env.ENABLE_BULLMQ_DASHBOARD === 'true' && !this.identityManager.isCloud()) {
            // Initialize admin queues rate limiter
            const id = 'bullmq_admin_dashboard'
            await this.rateLimiterManager.addRateLimiter(
                id,
                60,
                100,
                process.env.ADMIN_RATE_LIMIT_MESSAGE || 'Too many requests to admin dashboard, please try again later.'
            )

            const rateLimiter = this.rateLimiterManager.getRateLimiterById(id)
            this.app.use('/admin/queues', rateLimiter, verifyTokenForBullMQDashboard, this.queueManager.getBullBoardRouter())
        }

        // All other requests not handled will return JSON 404
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({ error: 'Not found' })
        })

        // Error handling
        this.app.use(errorHandlerMiddleware)
    }

    async stopApp() {
        try {
            const removePromises: any[] = []
            removePromises.push(this.telemetry.flush())
            if (this.queueManager) {
                removePromises.push(this.redisSubscriber.disconnect())
            }
            await Promise.all(removePromises)
        } catch (e) {
            logger.error(`❌[server]: shift left  Server shut down error: ${e}`)
        }
    }
}

let serverApp: App | undefined

export async function start(): Promise<void> {
    serverApp = new App()

    const host = process.env.HOST
    const port = parseInt(process.env.PORT || '', 10) || 3000
    const server = http.createServer(serverApp.app)

    await serverApp.initDatabase()
    await serverApp.config()

    server.listen(port, host, () => {
        logger.info(`⚡️ [server]: shift left  Server is listening at ${host ? 'http://' + host : ''}:${port}`)
    })
}

export function getInstance(): App | undefined {
    return serverApp
}
