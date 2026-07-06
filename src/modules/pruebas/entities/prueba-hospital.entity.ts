import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pruebas_hospitales')
export class PruebaHospital {
  @PrimaryGeneratedColumn({ name: 'id_prueba_hospital' })
  idPruebaHospital: number;

  @Column({ name: 'id_prueba', type: 'integer' })
  idPrueba: number;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'show', type: 'boolean', default: true })
  show: boolean;
}
