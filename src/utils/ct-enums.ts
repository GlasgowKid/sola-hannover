export enum MemberStatus {
    ACTIVE = 'active',
    REQUESTED = 'requested',
    TO_DELETE = 'to_delete',
    WAITING = 'waiting',
}

export enum MovementState {
    OPEN = 'open',
    BOOKED = 'booked',
    IGNORED = 'ignored',
}

/**
 * Domain types that notes can be used with
 */
export enum NoteDomainType {
    FOLLOW_UP = 'follow_up',
    GROUP = 'group',
    PERSON = 'person',
    SONG_ARRANGEMENT = 'song_arrangement',
}

export enum OrderStatus {
    AUFTRAG = 'Auftrag',
    FINDER = 'Finder',
    FINDER_COMBO = 'FinderCombo',
    WEBSITE_COMBO = 'WebsiteCombo',
    TESTPHASE = 'Testphase',
    ENTSCHEIDUNG = 'Entscheidung',
    BEDENKZEIT = 'Bedenkzeit',
    MITARBEITER = 'Mitarbeiter',
    ZU_LÖSCHEN = 'zu löschen',
    VORLAGE_SCHULUNG_TEST = 'Vorlage/Schulung/Test',
    UNBEKANNT = 'Unbekannt',
}

export enum PersonPostsFilterParam {
    PUBLICATION_FUTURE = 'publication_future',
    EXPIRATION_FUTURE = 'expiration_future',
    EXPIRATION_PAST = 'expiration_past',
    PUBLISHED = 'published',
    BANNED = 'banned',
}

export enum PostVisibility {
    GROUP_VISIBLE = 'group_visible',
    GROUP_INTERN = 'group_intern',
}

export enum ReportObjectStatus {
    PENDING = 'pending',
    PENDING_AGAIN = 'pending-again',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
}

export enum ReportStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
}

export enum RoleType {
    PARTICIPANT = 'participant',
    LEADER = 'leader',
}

/**
 * 1 = PENDING, 2 = CONFIRMED, 3 = CANCELED, 99 = DELETED
 */
export enum StatusId {
    /**
     * PENDING
     */
    PENDING = 1,
    /**
     * CONFIRMED
     */
    CONFIRMED = 2,
    /**
     * CANCELED
     */
    CANCELED = 3,
    /**
     * DELETED
     */
    DELETED = 99,
}

export enum VerificationStatus {
    IN_PROGRESS = 'in_progress',
    VERIFIED = 'verified',
    NOT_VERIFIED = 'not_verified',
    FAILED = 'failed',
}

/**
 * Special color values used for groups
 */
export enum AddressColor {
    DEFAULT = 'default',
    PARENT = 'parent',
}

/**
 * Possible keys that the song is arranged in
 */
export enum ArrangementKey {
    A = 'A',
    AB = 'Ab',
    B = 'B',
    BB = 'Bb',
    C = 'C',
    D = 'D',
    DB = 'Db',
    E = 'E',
    EB = 'Eb',
    F = 'F',
    'F#' = 'F#',
    G = 'G',
    GB = 'Gb',
    AM = 'Am',
    BM = 'Bm',
    BBM = 'Bbm',
    CM = 'Cm',
    'C#M' = 'C#m',
    DM = 'Dm',
    'D#M' = 'D#m',
    EM = 'Em',
    EBM = 'Ebm',
    FM = 'Fm',
    'F#M' = 'F#m',
    GM = 'Gm',
    'G#M' = 'G#m',
}

/**
 * This is a string that can only be true or false.
 */
export enum BooleanString {
    _0 = '0',
    _1 = '1',
}

/**
 * status of chat room
 */
export enum ChatStatus {
    NOT_STARTED = 'NOT_STARTED',
    STARTING = 'STARTING',
    STARTED = 'STARTED',
    STOPPED = 'STOPPED',
}

/**
 * A color in ChurchTools
 */
export enum CtColor {
    ACCENT = 'accent',
    AMBER = 'amber',
    BASIC = 'basic',
    BLUE = 'blue',
    CRITICAL = 'critical',
    CONSTRUCTIVE = 'constructive',
    CYAN = 'cyan',
    EMERALD = 'emerald',
    ERROR = 'error',
    FUCHSIA = 'fuchsia',
    GREEN = 'green',
    INDIGO = 'indigo',
    INFO = 'info',
    LIME = 'lime',
    MAGIC = 'magic',
    ORANGE = 'orange',
    PINK = 'pink',
    PURPLE = 'purple',
    RED = 'red',
    ROSE = 'rose',
    SKY = 'sky',
    SUCCESS = 'success',
    TEAL = 'teal',
    VIOLET = 'violet',
    WARNING = 'warning',
    YELLOW = 'yellow',
    DESTRUCTIVE = 'destructive',
}

export enum CtModule {
    CHURCHCAL = 'churchcal',
    CHURCHCHECKIN = 'churchcheckin',
    CHURCHDB = 'churchdb',
    CHURCHFINANCE = 'churchfinance',
    CHURCHGROUP = 'churchgroup',
    CHURCHREPORT = 'churchreport',
    CHURCHRESOURCE = 'churchresource',
    CHURCHSERVICE = 'churchservice',
    CHURCHSYNC = 'churchsync',
    CHURCHWIKI = 'churchwiki',
    FINANCE = 'finance',
    POST = 'post',
}

/**
 * The intern code of the field category the field belongs to. This is used to define the category of the field.
 */
export enum FieldCategoryCode {
    F_GROUP = 'f_group',
    F_ADDRESS = 'f_address',
    F_CHURCH = 'f_church',
    F_CATEGORY = 'f_category',
    F_DEP = 'f_dep',
    F_GROWPATH = 'f_growpath',
    F_DATASECURITY = 'f_datasecurity',
}

/**
 * The intern code of the field type the field belongs to. This is used to define the type of the field.
 */
export enum FieldTypeCode {
    SELECT = 'select',
    TEXT = 'text',
    DATE = 'date',
    DATETIME = 'datetime',
    TEXTAREA = 'textarea',
    CHECKBOX = 'checkbox',
    NUMBER = 'number',
    MULTISELECT = 'multiselect',
    API = 'api',
    RADIOSELECT = 'radioselect',
}

export enum FollowUpFilter {
    DUE_TODAY = 'due-today',
    DUE_AFTER_TODAY = 'due-after-today',
    DUE_BEFORE_TODAY = 'due-before-today',
    DUE_UNSPECIFIED = 'due-unspecified',
    DONE = 'done',
}

export enum GroupMeetingAttendance {
    ABSENT = 'absent',
    NOT_IN_GROUP = 'not-in-group',
    PRESENT = 'present',
    UNSURE = 'unsure',
}

/**
 * The visibility of a group.
 */
export enum GroupVisibility {
    HIDDEN = 'hidden',
    INTERN = 'intern',
    RESTRICTED = 'restricted',
    PUBLIC = 'public',
}

export enum HtmlTemplateDomainType {
    EMAIL = 'email',
    BULKLETTER = 'bulkletter',
    GROUPMEMBER_DOCUMENT = 'groupmember-document',
    DONATION_RECEIPT_LETTER = 'donation-receipt-letter',
    DONATION_RECEIPT_ATTACHMENT = 'donation-receipt-attachment',
}

export enum InvitationStatus {
    NOT_INVITED = 'not_invited',
    ACCEPTED = 'accepted',
    PENDING = 'pending',
}

/**
 * The language code is a two-letter code that represents the language. For example, "en" for English, "de" for German, and "fr" for French.
 */
export enum LanguageCode {
    DE = 'de',
    EN = 'en',
    FR = 'fr',
    ES = 'es',
    CN = 'cn',
    TW = 'tw',
    FA = 'fa',
    PT = 'pt',
    RU = 'ru',
    NL = 'nl',
    PL = 'pl',
    IT = 'it',
    FI = 'fi',
}

/**
 * Flavor of widget action
 */
export enum WidgetActionFlavor {
    ACCENT = 'accent',
    BASIC = 'basic',
    CONSTRUCTIVE = 'constructive',
    DESTRUCTIVE = 'destructive',
    MAGIC = 'magic',
}

/**
 * Type of widget action
 */
export enum WidgetActionType {
    PRIMARY = 'primary',
    SECONDARY = 'secondary',
    DETAILS = 'details',
    OTHER = 'other',
}

/**
 * Density options for common widgets
 */
export enum WidgetDensity {
    DEFAULT = 'default',
    DIVIDED = 'divided',
    COMPACT = 'compact',
}

/**
 * Strategy for handling empty widget content
 */
export enum WidgetEmptyStrategy {
    SHOW = 'SHOW',
    HIDE = 'HIDE',
}

/**
 * Direction for widget info lists
 */
export enum WidgetInfoListDirection {
    HORIZONTAL = 'horizontal',
    VERTICAL = 'vertical',
    WRAPPED = 'wrapped',
}

/**
 * Size options for widget info lists
 */
export enum WidgetInfoListSize {
    SMALL = 'small',
    MEDIUM = 'medium',
}

/**
 * The direction of the result set
 */
export enum DirectionParameter {
    FORWARD = 'forward',
    BACKWARD = 'backward',
}

/**
 * Group visibility
 */
export enum GroupFilterVisibility {
    HIDDEN = 'hidden',
    PUBLIC = 'public',
    RESTRICTED = 'restricted',
    INTERN = 'intern',
}

/**
 * Status of a group membership
 */
export enum GroupMemberStatus {
    ACTIVE = 'active',
    REQUESTED = 'requested',
    WAITING = 'waiting',
    TO_DELETE = 'to_delete',
}

export enum PermissionDomainType {
    STATUS = 'status',
    GROUP_TYPE_ROLE = 'group_type_role',
    GROUP_ROLE = 'group_role',
    PERSON = 'person',
}

export enum SubscriptionSubject {
    POST = 'post',
    POST_SUMMARY = 'post_summary',
    GROUP = 'group',
    PUBLIC_CHANNEL = 'public_channel',
    MEETINGREQUESTS = 'meetingrequests',
    SERVICEREQUESTS = 'servicerequests',
}

/**
 * Domain types that tags can be used with
 */
export enum TagDomainType {
    PERSON = 'person',
    GROUP = 'group',
    SONG = 'song',
}
