import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-ticket-form',
    templateUrl: './ticket-form.component.html',
  })
export class TicketFormComponent {
    constructor(
        public dialogRef: MatDialogRef<TicketFormComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any ) {}

    onNoClick(): void {
        this.dialogRef.close();
    }
}
