require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
    const email = 'kevalgajjarm@gmail.com';
    const password = 'Keval2004@@';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const uni = await prisma.university.findFirst();
        const uniId = uni ? uni.id : null;

        if (!uniId) {
            console.log('Error: You need at least one University in the DB first.');
            return;
        }

        const admin = await prisma.staff.upsert({
            where: { email },
            update: {},
            create: {
                email,
                password_hash: hashedPassword,
                name: 'System Super Admin',
                role: 'super_admin',
                university_id: uniId
            }
        });

        console.log(`✅ Super Admin created successfully!`);
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
    } catch (err) {
        console.error('Error creating superadmin:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
