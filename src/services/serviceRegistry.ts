import { Context, ConnectorError, ConnectorErrorType, StandardCommand } from '@sailpoint/connector-sdk'
import { FusionConfig } from '../model/config'
import { LogService } from './logService'
import { InMemoryLockService, LockService } from './lockService'
import { ClientService } from './clientService'
import { SourceService } from './sourceService'
import { FusionService } from './fusionService'
import { IdentityService } from './identityService'
import { SchemaService } from './schemaService'
import { FormService } from './formService'
import { AttributeService } from './attributeService'
import { EntitlementService } from './entitlementService'
import { ScoringService } from './scoringService'
import { MessagingService } from './messagingService'

export class ServiceRegistry {
    private static current?: ServiceRegistry
    public log: LogService
    public locks: LockService
    public client: ClientService
    public sources: SourceService
    public fusion: FusionService
    public identities: IdentityService
    public schemas: SchemaService
    public forms: FormService
    public attributes: AttributeService
    public entitlements: EntitlementService
    public scoring: ScoringService
    public messaging: MessagingService

    constructor(
        public config: FusionConfig,
        private context: Context
    ) {
        // Initialize core services first
        this.log = context.logService ?? new LogService(this.config)
        this.locks = context.lockService ?? new InMemoryLockService(this.log)
        this.client = context.connectionService ?? new ClientService(this.config, this.log)

        // Initialize services that don't depend on others
        this.sources = context.sourceService ?? new SourceService(this.config, this.log, this.client)
        this.entitlements = context.entitlementService ?? new EntitlementService(this.log, this.sources)
        this.scoring = context.scoringService ?? new ScoringService(this.config, this.log)
        this.identities = context.identityService ?? new IdentityService(this.config, this.log, this.client)
        this.messaging =
            context.messagingService ??
            new MessagingService(this.config, this.log, this.client, this.sources, this.identities)
        this.forms =
            context.formService ??
            new FormService(this.config, this.log, this.client, this.sources, this.identities, this.messaging)

        // Initialize services that depend on others (in dependency order)
        this.schemas = context.schemaService ?? new SchemaService(this.config, this.log, this.sources)
        const commandType = context.commandType as StandardCommand | undefined
        this.attributes =
            context.attributesService ??
            new AttributeService(this.config, this.schemas, this.sources, this.log, this.locks, commandType)

        // Initialize FusionService last (depends on multiple services)
        this.fusion =
            context.fusionService ??
            new FusionService(
                this.config,
                this.log,
                this.identities,
                this.sources,
                this.forms,
                this.attributes,
                this.scoring,
                this.schemas,
                commandType
            )
    }

    static setCurrent(reg: ServiceRegistry) {
        this.current = reg
    }
    static getCurrent(): ServiceRegistry {
        if (!this.current) {
            throw new ConnectorError('ServiceRegistry not found', ConnectorErrorType.Generic)
        }
        return this.current!
    }

    static clear() {
        this.current = undefined
    }
}
