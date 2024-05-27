import { PrismaClient } from "@prisma/client";
import {Prisma} from "@prisma/client";

const prisma = new PrismaClient()
const prisma2 = new PrismaClient();
const owner = 'John Doe';
const balance = 100;

describe('ISOLATION LEVELS', () => {
    beforeEach(async () => {
        await prisma.bank.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
        await prisma2.$disconnect();
    });

    describe('READ_COMMITTED', () => {
        it('nonrepeatable read - occurs - second and first select results are different', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.updateMany({
                    where: {
                        owner,
                    },
                    data: {
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });

             await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(1);
                expect(result[0].owner).toBe(owner);
                expect(result[0].balance).toBe(balance + 100);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });
        });
        it('phantom read - occurs - first transactions see committed insert from second one', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.create({
                    data: {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });

            await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(2);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });
        });
        it('serialization anomaly - occurs - 2 rows with the same data inserted', async () => {
            await prisma.bank.createMany({
                data: [
                    {
                        owner,
                        balance,
                    },
                    {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                    {
                        owner: owner + '2',
                        balance: balance + 200,
                    }
                    ],
            });

            const t1 = prisma.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                  data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                  }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            });

            const t2 = prisma2.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                    data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                    }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            })  ;

            await Promise.all([t1, t2]);

            const owners = await prisma.bank.findMany({
                where: { owner: 'sum' },
                orderBy: { id: 'asc'}
            });
            expect(owners).toHaveLength(2);
            expect(owners[0].balance).toBe(600)
            expect(owners[1].balance).toBe(600)
        });
    });
    describe('REPEATABLE_READ', () => {
        it('nonrepeatable read - doesnt allowed - doesnt exists, transaction is isolated from commited changes from another transaction', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.updateMany({
                    where: {
                        owner,
                    },
                    data: {
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });

            await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(1);
                expect(result[0].owner).toBe(owner);
                expect(result[0].balance).toBe(balance);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });
        });
        it('phantom read - in postgress not allowed in Repeatable-Read(allowed in other engines) - transaction is isolated from data from other commited transactions', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.create({
                    data: {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });

            await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(1);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });
        });
        it('serialization anomaly - occurs - both transaction run concurrency insert the same value', async () => {
            await prisma.bank.createMany({
                data: [
                    {
                        owner,
                        balance,
                    },
                    {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                    {
                        owner: owner + '2',
                        balance: balance + 200,
                    }
                ],
            });

            const t1 = prisma.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                    data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                    }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            });

            const t2 = prisma2.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                    data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                    }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
            })  ;

            await Promise.all([t1, t2]);

            const owners = await prisma.bank.findMany({
                where: { owner: 'sum' },
                orderBy: { id: 'asc'},
            });
            expect(owners).toHaveLength(2);
            expect(owners[0].balance).toBe(600)
            expect(owners[1].balance).toBe(600)
        });
    });
    describe('SERIALIZABLE', () => {
        it('nonrepeatable read - doesnt allowed - transaction doesnt see any commited changes from another transactions', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.updateMany({
                    where: {
                        owner,
                    },
                    data: {
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });

            await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(1);
                expect(result[0].owner).toBe(owner);
                expect(result[0].balance).toBe(balance);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        });
        it('phantom read - doesnt allowed - all selects in transaction return consistency value', async () => {
            await prisma.bank.create({
                data: {
                    owner,
                    balance,
                },
            });
            const query2 = prisma2.$transaction(async (t) => {
                await t.bank.create({
                    data: {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                });
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });

            await prisma.$transaction(async (t) => {
                const users = await t.bank.findMany();
                expect(users).toHaveLength(1);
                expect(users[0].owner).toBe(owner);
                expect(users[0].balance).toBe(balance);

                await new Promise((resolve) => {
                    resolve(query2)
                });

                const result = await t.bank.findMany();

                expect(result).toHaveLength(1);
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });
        });
        it('serialization anomaly - doesnt allowed - throws error', async () => {
            await prisma.bank.createMany({
                data: [
                    {
                        owner,
                        balance,
                    },
                    {
                        owner: owner + '1',
                        balance: balance + 100,
                    },
                    {
                        owner: owner + '2',
                        balance: balance + 200,
                    }
                ],
            });

            const t1 = prisma.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                    data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                    }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            });

            const t2 = prisma2.$transaction(async (t) => {
                const result: { sum: BigInt }[] = await t.$queryRaw`SELECT SUM(balance) as sum FROM banks`;
                expect(Number(result[0].sum)).toBe(600)

                await t.bank.create({
                    data: {
                        owner: 'sum',
                        balance: Number(result[0].sum),
                    }
                })
            }, {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            })  ;

            try {
                await Promise.all([t1, t2]);
            } catch (e) {
                expect(e).toBeDefined();
                expect(e).toBeInstanceOf(Error);
            }
        });
    });
});