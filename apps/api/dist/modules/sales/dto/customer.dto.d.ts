export declare class ListCustomersQueryDto {
    q?: string;
    tierId?: string;
    page?: number;
    pageSize?: number;
}
export declare class CreateCustomerDto {
    name: string;
    tierId: string;
    email?: string;
}
export declare class UpdateCustomerDto {
    name?: string;
    tierId?: string;
    email?: string;
}
