import { RolUsuarioAdmin } from '../enums/rol-usuario-admin.enum';

export interface JwtPayloadAdmin {
  sub: string;
  type: 'admin';
  rol: RolUsuarioAdmin;
  tenants?: string[];
  /** true si el usuario tiene firma (URL no vacía) en la base de datos */
  signature: boolean;
  iat?: number;
  exp?: number;
}

export interface JwtPayloadAspirante {
  sub: string;
  type: 'aspirante';
  tenantId: string;
  slug: string;
  registro: string;
  /** Nombre completo del aspirante (para mostrar en el frontend) */
  nombre: string;
  /** order_id del paso actual en evaluation_flow_steps */
  evaluationFlowOrderId?: number;
  /** descripcion del paso actual (texto para UI) */
  evaluationFlowDescripcion?: string;
  iat?: number;
  exp?: number;
}

export type JwtPayload = JwtPayloadAdmin | JwtPayloadAspirante;

export function isAdminPayload(p: JwtPayload): p is JwtPayloadAdmin {
  return p.type === 'admin';
}

export function isAspirantePayload(p: JwtPayload): p is JwtPayloadAspirante {
  return p.type === 'aspirante';
}
