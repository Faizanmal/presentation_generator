import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateThemes() {
    await prisma.theme.updateMany({
        where: { name: 'Sunset Orange' },
        data: { isDefault: true, isPremium: false }
    });
    await prisma.theme.updateMany({
        where: { name: 'Modern Light' },
        data: { isDefault: false }
    });
    console.log('Themes successfully updated in DB.');
}

updateThemes()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
