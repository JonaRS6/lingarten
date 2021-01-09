import { Timestamp } from 'rxjs/internal/operators/timestamp';

export class ClienteModel {
    id: string;
    name: string;
    lastname: string;
    email?: string;
    tel1: number;
    tel2?: number;
    address: {
        state?: string;
        district?: string;
        colony: string;
        street: string;
        no: string;
        building?: string;
    };
    service: {
        type: string;
        day: string;
        cost: number;
    };
    status: string;
    registerDate: Date | Timestamp<any>;
    cancelDate?: Date;
    position: number;
    active: boolean;
    printq: boolean;
    constructor() {
        this.registerDate = new Date();
        this.position = 0;
        this.active = true;
        this.printq = true;
    }
}
export class ClienteTable {
    client: ClienteModel;
    isPayLoading: boolean;
}