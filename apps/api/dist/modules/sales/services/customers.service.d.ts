import { type Paginated } from '@dealflow/contracts';
import { PrismaService } from '../../shared/prisma.service';
import type { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from '../dto/customer.dto';
export declare class CustomersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    list(query: ListCustomersQueryDto): Promise<Paginated<unknown>>;
    get(id: string): Promise<{
        tier: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
        };
    } & {
        id: string;
        name: string;
        tierId: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(dto: CreateCustomerDto): import("@prisma/client").Prisma.Prisma__CustomerClient<{
        tier: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
        };
    } & {
        id: string;
        name: string;
        tierId: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateCustomerDto): Promise<{
        tier: {
            id: string;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            code: string;
        };
    } & {
        id: string;
        name: string;
        tierId: string;
        email: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
