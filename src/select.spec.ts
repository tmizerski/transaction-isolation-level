import { PrismaClient } from "@prisma/client";
import {Prisma} from "@prisma/client";

const prisma = new PrismaClient()
const prisma2 = new PrismaClient();
const email = 'test@test.pl';
const password = 'password';

describe('SELECT', () => {
    beforeAll(async () => {
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
        await prisma2.$disconnect();
    });

    describe('READ_COMMITTED', () => {
        it('nonrepeatable read', async () => {
            await prisma.user.create({
                data: {
                    email,
                    password,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.user.update({
                    where: {
                        email,
                    },
                    data: {
                        email: email + '1',
                        password: password + '1',
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });

             await prisma.$transaction(async (t) => {
                const users = await t.user.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].email).toBe(email);
                expect(users[0].password).toBe(password);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.user.findMany();

                expect(result).toHaveLength(1);
                expect(result[0].email).toBe(email + '1');
                expect(result[0].password).toBe(password + '1');
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });
        });
    });
});