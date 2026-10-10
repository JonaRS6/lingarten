import { Component, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { ClientdataService } from '../../services/clientdata.service';
import { PaymentsService } from '../../services/payments.service';
import { Payment } from '../../models/payment.model';
import {
  guessHeaderRow, parseCsv, readDeposits, StatementColumns, StatementDeposit
} from '../../core/statement-csv';

interface ClientOption {
  id: string;
  label: string;
}

// Remembers the columns picked for each bank layout, in this browser only.
const COLUMNS_KEY = 'statementColumns:';
const PREVIEW_ROWS = 5;

@Component({
  selector: 'app-payments',
  templateUrl: './payments.component.html',
  styles: [`
    .description { max-width: 360px; word-break: break-word; }
  `]
})
export class PaymentsComponent implements OnDestroy {

  // Statement being imported
  fileName = '';
  rows: string[][] = [];
  headerRow = 0;
  columns: StatementColumns = { date: null, amount: null, description: [] };
  deposits: StatementDeposit[] = [];
  skipped = 0;
  importing = false;

  unmatched: Payment[] = [];
  recent: Payment[] = [];
  clientOptions: ClientOption[] = [];
  clientNames = new Map<string, string>();
  // Client picked for each unmatched payment
  selection: { [paymentId: string]: string } = {};
  busy: { [paymentId: string]: boolean } = {};

  private destroy$ = new Subject<void>();

  constructor( private payments: PaymentsService, private clientData: ClientdataService ) {
    this.clientData.clients.pipe(
      map(rows => rows.map(row => row.client)),
      takeUntil(this.destroy$)
    ).subscribe(clients => {
      this.clientNames = new Map(clients.map(client => [client.id, `${client.name} ${client.lastname}`]));
      this.clientOptions = clients
        .filter(client => client.active !== false)
        .map(client => ({
          id: client.id,
          label: `${client.name} ${client.lastname}${client.paymentRef ? ` · ${client.paymentRef}` : ''}`
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });
    this.subscribe(this.payments.getUnmatched(), payments => this.unmatched = payments);
    this.subscribe(this.payments.getRecent(), payments => this.recent = payments);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get header(): string[] {
    return this.rows[this.headerRow] || [];
  }

  get headerRowOptions(): number[] {
    return this.rows.slice(0, 15).map((_, index) => index);
  }

  get preview(): StatementDeposit[] {
    return this.deposits.slice(0, PREVIEW_ROWS);
  }

  get total(): number {
    return this.deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  }

  get columnsReady(): boolean {
    return this.columns.date !== null && this.columns.amount !== null && this.columns.description.length > 0;
  }

  async loadFile( event: Event ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) {
      return;
    }
    this.fileName = file.name;
    this.rows = parseCsv(await file.text());
    input.value = '';
    this.headerRow = guessHeaderRow(this.rows);
    this.columns = this.rememberedColumns() || { date: null, amount: null, description: [] };
    this.refresh();
  }

  changeHeaderRow(): void {
    this.columns = this.rememberedColumns() || { date: null, amount: null, description: [] };
    this.refresh();
  }

  refresh(): void {
    if (!this.columnsReady) {
      this.deposits = [];
      this.skipped = 0;
      return;
    }
    const result = readDeposits(this.rows, this.headerRow, this.columns);
    this.deposits = result.deposits;
    this.skipped = result.skipped;
  }

  clearFile(): void {
    this.fileName = '';
    this.rows = [];
    this.deposits = [];
    this.skipped = 0;
  }

  async importStatement(): Promise<void> {
    if (this.deposits.length === 0 || this.importing) {
      return;
    }
    this.importing = true;
    this.rememberColumns();
    try {
      const summary = await this.payments.importDeposits(this.deposits);
      Swal.fire({
        title: 'Estado de cuenta importado',
        html: `${summary.applied} pagos aplicados a clientes<br>
          ${summary.unmatched} pagos por conciliar<br>
          ${summary.duplicate} ya se habían importado`,
        icon: 'success'
      });
      this.clearFile();
    } catch (error) {
      console.error('No se pudo importar el estado de cuenta.', error);
      Swal.fire('Error', 'No se pudo importar el estado de cuenta. Los pagos ya guardados no se duplicarán al reintentar.', 'error');
    } finally {
      this.importing = false;
    }
  }

  async assign( payment: Payment ): Promise<void> {
    const clientId = this.selection[payment.id];
    if (!clientId) {
      return;
    }
    this.busy[payment.id] = true;
    try {
      await this.payments.assign(payment.id, clientId);
    } catch (error) {
      console.error('No se pudo asignar el pago.', error);
      Swal.fire('Error', 'No se pudo asignar el pago', 'error');
    } finally {
      this.busy[payment.id] = false;
    }
  }

  async ignore( payment: Payment ): Promise<void> {
    const result = await Swal.fire({
      title: 'Ignorar pago',
      text: 'El depósito no se aplicará a ningún cliente',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4a148c',
      confirmButtonText: 'Ignorar',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) {
      return;
    }
    this.busy[payment.id] = true;
    try {
      await this.payments.ignore(payment.id);
    } catch (error) {
      console.error('No se pudo ignorar el pago.', error);
      Swal.fire('Error', 'No se pudo ignorar el pago', 'error');
    } finally {
      this.busy[payment.id] = false;
    }
  }

  async assignMissingReferences(): Promise<void> {
    try {
      const { assigned } = await this.payments.assignMissingReferences();
      Swal.fire('Referencias asignadas', `${assigned} clientes recibieron referencia de pago`, 'success');
    } catch (error) {
      console.error('No se pudieron asignar las referencias.', error);
      Swal.fire('Error', 'No se pudieron asignar las referencias', 'error');
    }
  }

  clientName( clientId: string ): string {
    return this.clientNames.get(clientId) || 'Cliente eliminado';
  }

  statusLabel( payment: Payment ): string {
    return { applied: 'Aplicado', unmatched: 'Por conciliar', ignored: 'Ignorado' }[payment.status];
  }

  private subscribe( source: Observable<Payment[]>, next: (payments: Payment[]) => void ): void {
    source.pipe(takeUntil(this.destroy$)).subscribe(next, error => console.error('No se pudieron leer los pagos.', error));
  }

  private columnsKey(): string {
    return COLUMNS_KEY + this.header.join('|');
  }

  private rememberedColumns(): StatementColumns | null {
    try {
      const stored = JSON.parse(localStorage.getItem(this.columnsKey()));
      return stored && Array.isArray(stored.description) ? stored : null;
    } catch {
      return null;
    }
  }

  private rememberColumns(): void {
    try {
      localStorage.setItem(this.columnsKey(), JSON.stringify(this.columns));
    } catch {
      // Only a convenience: the columns are picked again next time.
    }
  }
}
