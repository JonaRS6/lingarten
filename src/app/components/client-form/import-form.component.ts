import { Component, Inject } from '@angular/core';
import { NgModel } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'app-import-form',
    templateUrl: './first-ticket-import.html',
  })
export class ImportFormComponent {
    constructor(
        public dialogRef: MatDialogRef<ImportFormComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any ) {}

    onNoClick(): void {
        this.dialogRef.close();
    }
}
