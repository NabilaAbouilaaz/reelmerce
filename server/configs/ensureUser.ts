import { clerkClient } from '@clerk/express';
import { prisma } from './prisma.js';

// Creates the user in the database if the Clerk "user.created" webhook never arrived,
// so a signed-in user always has a row (and the default 20 credits).
export const ensureUser = async (userId: string) => {
    const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (existing) return;

    const u = await clerkClient.users.getUser(userId);
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: u.emailAddresses[0]?.emailAddress ?? '',
            name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
            image: u.imageUrl ?? '',
        },
    });
};
