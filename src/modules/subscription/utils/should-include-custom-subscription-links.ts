export function shouldIncludeCustomSubscriptionLinks(user: { status: string }): boolean {
    return user.status === 'ACTIVE';
}
