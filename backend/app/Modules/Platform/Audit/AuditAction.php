<?php

declare(strict_types=1);

namespace App\Modules\Platform\Audit;

/**
 * Ações auditadas (Security → Audit logs). O valor é o que vai para `audit_logs.action`.
 */
enum AuditAction: string
{
    case LoginSucceeded = 'auth.login_succeeded';
    case LoginFailed = 'auth.login_failed';
    case Logout = 'auth.logout';
    case PasswordResetRequested = 'auth.password_reset_requested';
    case PasswordChanged = 'auth.password_changed';

    case LeadStatusChanged = 'lead.status_changed';
    case LeadAssigned = 'lead.assigned';
    case LeadErased = 'lead.erased';

    case BulletinCreated = 'bulletin.created';
    case BulletinUpdated = 'bulletin.updated';
    case BulletinPdfReplaced = 'bulletin.pdf_replaced';
    case BulletinDeleted = 'bulletin.deleted';

    case PalavraVivaCreated = 'palavra_viva.created';
    case PalavraVivaUpdated = 'palavra_viva.updated';
    case PalavraVivaDeleted = 'palavra_viva.deleted';

    case EventCreated = 'event.created';
    case EventUpdated = 'event.updated';
    case EventPublished = 'event.published';
    case EventUnpublished = 'event.unpublished';
    case EventDeleted = 'event.deleted';

    case RegistrationCancelled = 'registration.cancelled';
    case RegistrationErased = 'registration.erased';
    case RegistrationsExported = 'registrations.exported';

    case MinistryCreated = 'ministry.created';
    case MinistryUpdated = 'ministry.updated';
    case MinistryDeleted = 'ministry.deleted';

    case SettingUpdated = 'setting.updated';
    case PixUpdated = 'pix.updated';

    case RetentionPurged = 'retention.purged';

    case ReleaseActivated = 'release.activated';
    case ReleaseRolledBack = 'release.rolled_back';
}
