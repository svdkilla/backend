import { UserEntity } from '@modules/users/entities/user.entity';

export function shouldIncludeCustomSubscriptionLinks(user: UserEntity): boolean {
    return user.status === 'ACTIVE';
}
