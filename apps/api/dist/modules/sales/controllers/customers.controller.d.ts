import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from '../dto/customer.dto';
import { CustomersService } from '../services/customers.service';
export declare class CustomersController {
    private readonly customers;
    constructor(customers: CustomersService);
    list(query: ListCustomersQueryDto): Promise<import("@dealflow/contracts").Paginated<unknown>>;
    get(id: string): Promise<{
        tier: {
            id: string;
            code: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        tierId: string;
        email: string | null;
    }>;
    create(dto: CreateCustomerDto): import("@prisma/client").Prisma.Prisma__CustomerClient<{
        tier: {
            id: string;
            code: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        tierId: string;
        email: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, dto: UpdateCustomerDto): Promise<{
        tier: {
            id: string;
            code: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        tierId: string;
        email: string | null;
    }>;
}
