/**
 * Utilidades de cálculo de IVA (Impuesto al Valor Agregado).
 *
 * Colombia aplica una tarifa general del 19 % (Ley 1819 de 2016, Art. 468 del
 * Estatuto Tributario), vigente para la generalidad de bienes y servicios,
 * incluida la ropa. El precio de venta que el propietario registra en el
 * sistema se interpreta como el precio final al público, con el IVA ya
 * incluido —la convención habitual del comercio al detal colombiano—, por lo
 * que este módulo lo descompone en su valor base (gravable) y el IVA
 * correspondiente, en vez de sumar el IVA por encima de un precio base.
 */

export const TASA_IVA_GENERAL = 0.19;

export interface DesgloseIva {
  valorBase: number;
  valorIva: number;
  valorTotal: number;
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Descompone un valor que YA INCLUYE IVA (por ejemplo, un precio de venta al
 * público) en su valor base gravable y el IVA correspondiente, de forma que
 * valorBase + valorIva sea igual a valorConIvaIncluido.
 */
export function descomponerIva(valorConIvaIncluido: number, tasa: number = TASA_IVA_GENERAL): DesgloseIva {
  const valorBase = valorConIvaIncluido / (1 + tasa);
  const valorIva = valorConIvaIncluido - valorBase;
  return {
    valorBase: redondear(valorBase),
    valorIva: redondear(valorIva),
    valorTotal: redondear(valorConIvaIncluido),
  };
}
